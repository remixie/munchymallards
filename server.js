//Munchy Mallards is a game created by Francisco Salinas.

// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

const PORT = process.env.PORT || 5000;

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var mallards = []; //list of active mallard sockets
var mallardQueue = []; //list of mallard IDs waiting for a game
var mallardRooms = [];

app.set('port', PORT);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function (request, response) {
	response.sendFile(path.join(__dirname, 'index.html'));
});

// Starts the server.
server.listen(PORT, function () {
	console.log('Starting server on port '+ PORT);

});


io.on('connection', function (socket) {


	mallards[socket.id] = {
		"username": "",
		"device_type": "",
		"socket": socket,
		"score": 0
	};
	//create mallard


	socket.emit('set-id', socket.id);
	//send id to client

	socket.emit('count', io.engine.clientsCount);
	//send mallard count to client

	console.log('\n'+socket.id + ' has connected.');
	//inform of new connection

	socket.on('show_info', function () {
		//shows debug information

		console.log("\nCurrent Scores:");

		for (var v in mallards) {

			console.log(v + " => " + mallards[v].score);
		}


		console.log("\nRooms that " + socket.id + " is currently in:");

		for (var r in socket.rooms) {
			console.log(socket.rooms[r]);
		}


	});

	socket.on('findMallard', function (device_type) {
		//client started a search for a mallard

		if(Object.keys(socket.rooms)[1] != undefined){
			var current_room = socket.rooms[Object.keys(socket.rooms)[1]];
			
			//console.log("room to delete: "+current_room);
			
			deleteRoom(current_room);
		}

		reset_score(socket.id);
		//reset score for the socket

		mallardQueue.push(socket.id);
		//add client's ID to queue

		if(mallards[socket.id].device_type==""){
			mallards[socket.id].device_type = device_type;
		}

		if(mallards[socket.id].username==""){
			socket.emit('get-username');
		}
		else{
			socket.emit('queue_message', 'Finding a mallard...');
		}

		console.log('\n' + socket.id + ' has queued up.');
		//inform that the client has queued
		

		if (mallardQueue.length == 2) {
		//if two mallards are in queue

			var mallardOne = mallards[mallardQueue[0]];
			var mallardTwo = mallards[mallardQueue[1]];

			mallardQueue = [];
			//empty the queue
			
				var check = setInterval(function(){
					if(mallardOne.username!="" && mallardTwo.username!=""){

						clearInterval(check);
						//clear interval

						room_setup(mallardOne.socket, mallardTwo.socket);
						//set up a room
						
					}
				},1000);

		}
	});

	socket.on('set-username', function (username) {
		mallards[socket.id].username = username;

		socket.emit('queue_message', 'Finding a mallard...');
	});

	socket.on('disconnecting', function () {

		for(var m in mallardQueue){
			if(mallardQueue[m] == socket.id){
				mallardQueue = [];
			}
		}

		var current_room = socket.rooms[Object.keys(socket.rooms)[1]];
		var room_index = get_room_index(current_room);

		if(room_index != undefined){
			if(mallardRooms[room_index].berries_remaining !=0){
				io.to(current_room).emit('forfeit');
				//inform that the player left
			}
			
			deleteRoom(current_room);
		}

	});

	socket.on('disconnect', function () {

		//when the client disconnects
		delete mallards[socket.id];

		console.log('\n' + socket.id + ' has disconnected.');
		//inform of disconnect

		//console.log("deleted both "+ io.sockets.adapter.rooms);
	});

	socket.on('send-cursor', function (x, y) {
		var opponentSocket = mallards[getOpponentSocketID(socket.id, socket.rooms[Object.keys(socket.rooms)[1]])].socket;


		opponentSocket.emit('get-cursor', x, y);
	});


	socket.on('berry_click', function (index) {

		var current_room = socket.rooms[Object.keys(socket.rooms)[1]];

		//console.log(socket.id+" clicked on berry "+index+" in room "+current_room);

		var room_index = get_room_index(current_room);
		
		if(mallardRooms[room_index] != undefined && mallardRooms[room_index].berry_list.indexOf(index)==-1){
						
			//console.log("Room "+current_room+" has "+mallardRooms[room_index].berries_remaining+ " berries remaining.");
			
			mallardRooms[room_index].berries_remaining -= 1;
				
			//socket.emit('delete_berry', index); //show delete to the same user
				
			io.to(current_room).emit('delete_berry', index); //show delete to both users

			mallardRooms[room_index].berry_list.push(index);
			mallards[socket.id].score += 5;
				
			var data = {
				"id": socket.id,
				"score": mallards[socket.id].score,
				"berries_left": mallardRooms[room_index].berries_remaining
			};
			
			io.to(current_room).emit('update_scores', data);
							
			if(mallardRooms[room_index].berries_remaining <= 0){
				io.to(current_room).emit('no_more_berries');
			}
		}
	});

});

function getOpponentSocketID(id, room_id){
	if(room_id.substring(0, 20) == id){
		return room_id.substring(20, 40);
	}
	else{
		return room_id.substring(0, 20);
	}
}

function get_room_index(room_id){
	
		for(var i = 0; i < mallardRooms.length; i++) {
		
			if(mallardRooms[i].id == room_id) {
				return i;
			}
		}
	}

function deleteRoom(room_id){
	
		var room_index = get_room_index(room_id);

		if(room_index !=undefined){
			mallardRooms.splice(room_index, 1);
		}
}

function room_setup(mallardOne_socket, mallardTwo_socket) {

	//console.log(mallardOne_socket.id + " is now playing against " + mallardTwo_socket.id + ".");

	var room_id = mallardOne_socket.id + mallardTwo_socket.id;
	//make a game id by concatenating the two IDs

	mallardRooms.push({id: room_id, berries_remaining: 51, berry_list: []});

	mallardOne_socket.emit('set-cursor-type', mallards[mallardTwo_socket.id].device_type);
	mallardTwo_socket.emit('set-cursor-type', mallards[mallardOne_socket.id].device_type);

	check_in(mallardOne_socket, room_id);
	check_in(mallardTwo_socket, room_id);

	start_game(room_id);
}


function check_in(socket, room_id) {
	var room_length = Object.keys(socket.rooms).length;

	if (room_length == 2) {

		socket.leave(socket.rooms[Object.keys(socket.rooms)[1]], function (err) {
			socket.join(room_id);
		});

	} else {
		socket.join(room_id);
	}

	
}

function showAllRooms(){

	console.log("\nList of rooms:\n");

	if(mallardRooms.length ==0){
		console.log("There are no active rooms.");
	}
	else{
		for(var i=0; i< mallardRooms.length; i++){
			console.log("\n Currently active room:"+ mallardRooms[i].id);
		}
	}
}


function start_game(room_id) {

	//showAllRooms();

	var count = 5;
	//the countdown before any game starts.

	var m1 = room_id.slice(0, 20);
	var m2 = room_id.slice(20, 40);

	var t = setInterval(function () {
		
		if(mallards[m1] == undefined || mallards[m2] == undefined)
		{
			clearInterval(t);
		}
		else{

			var data = {
				m1_user: mallards[m1].username,
				m1_device: mallards[m1].device_type,
				m2_user: mallards[m2].username,
				m2_device: mallards[m2].device_type,
				time: count
			}

			data = JSON.stringify(data);

			io.to(room_id).emit('timer', data); //send time

		}

		if(count == 0) {
			clearInterval(t);

			var berry_batch = make_berry_batch(); //make a batch of berries

			berry_batch = JSON.stringify(berry_batch);

			//console.log("Is M2 Connected? "+ mallards[m2].socket.connected);

			if(mallards[m1] != undefined && mallards[m2] != undefined){
				if(mallards[m1].socket.connected && mallards[m2].socket.connected){

					io.to(room_id).emit('draw_batch', berry_batch); //send the batch to be drawn
					io.to(room_id).emit('show_scores');
				}
			}
		}

		count--;
	}, 1000);

}

function make_berry_batch() { //show some berries

	var batch = [];

	var width_of_garden = 350;
	var height_of_garden = 400;

	var width_of_berry = 41;
	var height_of_berry = 50;

	var number_of_berries = 51;

	for (var c = 0; c < number_of_berries; c++) {

		batch[c] = {
			x: random_int(width_of_garden - width_of_berry),
			y: random_int(height_of_garden - height_of_berry),
			image: '/static/img/strawberry-2.png',
			width: width_of_berry,
			height: height_of_berry
		};
	}

	return batch;

}


function random_int(max) {
	return Math.floor(Math.random() * (max - 0 + 1) + 0);
}

function reset_score(socket_id) {
	mallards[socket_id].score = 0;
};

app.use('/', express.static(__dirname + '/www')); // redirect root
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap

app.use('/font', express.static(__dirname + '/node_modules/typicons.font/src/font')); // redirect CSS bootstrap