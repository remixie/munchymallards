var socket = io();
var Konva = require('konva');
var $ = jQuery = require("jquery");
var Howl = require("./js/howler.js");
require("bootstrap");
var bootbox = require('bootbox');
var my_id;
var active_connection = true;

var audio = new Howl({	src: ['/static/sounds/pop.mp3']   });
var win_audio = new Howl({	src: ['/static/sounds/win.mp3']   });
var lose_audio = new Howl({	src: ['/static/sounds/lose.mp3']   });

var x_cursor_coordinate;
var y_cursor_coordinate;
var cursor_tween;

audio.volume = 0.1;
win_audio.volume = 0.5;
lose_audio.volume = 0.5;

var stage = new Konva.Stage({
	container: 'stage',
	width: 350,
	height: 400
});

var area_layer = new Konva.Layer();
var area = new Konva.Rect({
	x: 0,
	y: 0,
	width: 350,
	height: 400,
});

area_layer.add(area);
stage.add(area_layer);


var layer = new Konva.Layer();
stage.add(layer);


var cursor_layer = new Konva.Layer();
var cursor_image = new Image();
cursor_image.onload = function() {

  var cursor = new Konva.Image({
	x: 0,
	y: 0,
	image: cursor_image,
	width: 20,
	height: 20
  });

  cursor_layer.add(cursor);

  stage.add(cursor_layer);
};



stage.on('touchmove mousemove', function(){

	x_cursor_coordinate = stage.getPointerPosition().x;
	y_cursor_coordinate = parseInt(stage.getPointerPosition().y);
	
	socket.emit('send-cursor', x_cursor_coordinate, y_cursor_coordinate);

});


layer.on('mouseup touchend', function (evt) { //when a user clicks on a berry
	socket.emit('berry_click', evt.target.getAttr('id'));
});


socket.on('get-cursor', function (x, y) {

	if(cursor_tween){
		cursor_tween.destroy();
	}

	cursor_tween = new Konva.Tween({
        node: cursor_layer,
        duration: 0,
        x: x,
        y: y,
	});
	
	cursor_tween.play();
});


socket.on('set-id', function (id) {
	my_id = id;
});

$("#play").on("click", function () {

	$("#menu").hide();
	$(".scores").hide();
	$("#help").hide();
	$('#count').hide();

	if(my_id ==""){
		$('.content').hide();
	}

	var device_type= "desktop";

	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
		device_type = "phone";
	}

	socket.emit('findMallard', device_type);

});

$("#help").on("click", function () {
	
	$("#help").hide();
	bootbox.alert("Click on as many strawberries as you can!"+
	" The game ends when a total of 51 strawberries have been gathered by both mallards."+
	" The total is shown behind the strawberries. If the total is green, that means you\'re winning!"+
	" Good luck!");
	
});

socket.on('count', function (count) {
	$('#count').text(count + " Mallard(s) online");
});

socket.on('get-username', function () {
	bootbox.prompt({
		title: "Enter a username:",
		closeButton: false,
		callback: function(result){

			if(result===null){
				return false;
			}

			else if(result==""){
				result = "Blank";
			}
			
			socket.emit('set-username', result);
			$('.content').show();
		},

		buttons: {
			cancel: {
				label: 'Cancel',
				className: 'hide'
			},
			confirm: {
				label: 'Submit',
				className: 'btn-default'
			}
		}
	});

	$(".hide").remove(); //to make sure the cancel button was removed.
});

socket.on('queue_message', function (message) {

	active_connection = true;
	$('#timer').text("");
	$('#connection-message').text(message);
});



socket.on('delete_berry', function (index) { //delete a berry

	if (audio.currentTime != 0) {
		audio.pause();
		audio.currentTime = 0;
	} 

	audio.play(); //play the sound

	var berry = stage.find("#" + index)[0];
	berry.destroy();
	layer.draw();
});


socket.on('draw_batch', function (berry_batch) { //draw a batch

	berry_batch = JSON.parse(berry_batch);

	stage.clear();
	area_layer.draw();
	cursor_layer.draw();

	layer.destroyChildren(); //get rid of any berries that may be present

	//console.log("drew batch.");
	//$.each(berry_batch, function (index, data) {
	for(var index = 0; index< berry_batch.length; index++)
	{

		drawBerry(berry_batch[index].image, berry_batch[index].x, berry_batch[index].y, index);

	}

});

function drawBerry(image, x,y, index){
	Konva.Image.fromURL(image, function (strawberry) {
		strawberry.setAttrs({
			id: index,
			x: x,
			y: y,
			width: 37,
			height: 50,
		});

		strawberry.on('mouseenter', function () {
			stage.container().style.cursor = 'pointer';
		});

		strawberry.on('mouseleave', function () {
			stage.container().style.cursor = 'default';
		});

		layer.add(strawberry);
		strawberry.draw();

	});
}


socket.on('set-cursor-type', function (cursor_type) {

	cursor_image.src = '/static/img/'+cursor_type+'.png';
});

socket.on('timer', function (data) {
	//displays countdown

	data = JSON.parse(data);

	if (data.time == 0) {

		$("#timer").text("");
		$("#stage").show();
		$("#left_duck").css("margin-top","200px");
		$("#right_duck").css("margin-top","200px");

	} else {
		if (active_connection) {
			$('#connection-message').text("");
		}

		$("#timer").html("<br><span class='typcn typcn-device-"+data.m1_device+"'></span>&nbsp;&nbsp;&nbsp;<span class='username_span'>"+data.m1_user+"</span> "+
		" vs <span class='username_span'>"+data.m2_user+"</span>&nbsp;&nbsp;&nbsp;<span class='typcn typcn-device-"+data.m2_device+"'></span><br><br>"+
		"This game starts in " + data.time + "!");
	}

});

socket.on('show_scores', function () {

	$('#my_score').text("0");
	$('#op_score').text("0");

	$(".scores").show();

});

socket.on('update_scores', function (data) {

	if (data.id == my_id) {
		$('#my_score').text(data.score);
	} else {
		$('#op_score').text(data.score);
	}

	if(parseInt($('#my_score').text()) > parseInt($('#op_score').text()))
	{
		$("#berries_remaining").css("color","#81b83c");
	}
	else{
		$("#berries_remaining").css("color","#d70719");
	}

	$("#berries_remaining").text(data.berries_left);
});

socket.on('no_more_berries', function (message) {
	var my_score = parseInt($("#my_score").text());
	var op_score = parseInt($("#op_score").text());

	audio.pause();

	var difference = Math.abs(my_score-op_score)/5;
	var grammar = "strawberries";
	if(	difference == 1)
	{
		grammar= "strawberry";
	}

	if (my_score > op_score) {

		$('#connection-message').html("You won by "+difference+" "+grammar+"!<br><br>");
	
		win_audio.play();

	} else {
		$('#connection-message').html("Your opponent won by "+difference+" "+grammar+"!<br><br>");
	
		lose_audio.play();
	}

	show_play_again();
});

socket.on('forfeit', function (message) {

	stage.clear();
	layer.destroyChildren();

	active_connection = false;
	//background_audio.pause();

	show_play_again();

	$("#timer").html("");

		$('#connection-message').html("You won by forfeit!<br><br>");

});

function stop_game(){
	stage.clear();
	$("#stage").hide();
	$(".scores").hide();
	
	$("#left_duck").css("margin-top","0px");
	$("#right_duck").css("margin-top","0px");
}	

function show_play_again() {

	$("#berries_remaining").text("");

	$("#menu").show();

	$("#play").text("Play Again");
	$("#play").hide();

	stop_game();

	setTimeout(function(){

		
		$("#play").fadeIn();

	},1000);
		

};