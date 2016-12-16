// Server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
connections = [];

server.listen(8081, "127.0.0.1");
console.log('Server running...')

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	connections.push(socket);
	console.log("Connected: %s sockets connected", connections.length)

	// Register
	socket.on('register', function(name){
		pm.AddNewPlayer(name);
		socket.emit('register', {'ID': connections.indexOf(socket), 'players': pm.players});
	});

	// Disconnect
	socket.on('disconnect', function(data){
		connections.splice(connections.indexOf(socket), 1);
		console.log("Disconnected: %s sockets connected", connections.length);
	})
});

// Player manager
var pm = {
	players: [],

	AddNewPlayer: function(name){
		position = this.GeneratePosition();
		color = this.GenerateColor();
		this.players.push({'name': name, 'position': position, 'color': color});
	},
	GeneratePosition: function(){
		return {'x': Math.floor((Math.random() * 600)), 'y': Math.floor((Math.random() * 600))};
	},
	GenerateColor: function(){
		return 'temp';
	}
}