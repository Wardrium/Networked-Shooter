// Server settings
var update_time = 0.1;	// How often to send updates to clients on movement data, in seconds.

// Server-----------------------------------------------------
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
		ID = pm.AddNewPlayer(name);
		socket.emit('register', {'ID': ID, 'players': pm.players});
		for (var i = 0; i < connections.length - 1; ++i){
			connections[i].emit('add player', pm.players[pm.players.length - 1]);
		}
	});

	// Update player position
	socket.on('update', function(data){
		if (connections.indexOf(socket) < pm.players.length){
			pm.players[connections.indexOf(socket)]['position'] = data['position'];
			pm.players[connections.indexOf(socket)]['velocity'] = data['velocity'];
		}
		else {
			console.log('Force disconnected');
			socket.disconnect();
		}
	});

	// Alert all clients of other clients' positions
	setInterval(function (){
		for (var i = 0; i < connections.length; ++i){
			connections[i].emit('update', pm.players);
		}
	}, update_time);

	// Disconnect
	socket.on('disconnect', function(data){
		if (connections.indexOf(socket) < pm.players.length){
			var DC_ID = pm.players[connections.indexOf(socket)]['ID'];
			pm.players.splice(connections.indexOf(socket), 1);
			for (var i = 0; i < connections.length; ++i){
				connections[i].emit('remove player', DC_ID);
			}
		}
		connections.splice(connections.indexOf(socket), 1);
		console.log("Disconnected: %s sockets connected", connections.length);
	})
});

// Player manager---------------------------------------------------
var pm = {
	ID_count: 0,
	players: [],

	AddNewPlayer: function(name){
		position = this._GeneratePosition();
		color = this._GenerateColor();
		velocity = {'x': 0, 'y': 0};
		this.players.push({'ID': this.ID_count, 'name': name, 'position': position, 'velocity': velocity, 'color': color});
		return this.ID_count++;
	},
	_GeneratePosition: function(){
		return {'x': Math.floor((Math.random() * 600)), 'y': Math.floor((Math.random() * 600))};
	},
	_GenerateColor: function(){
		return 'temp';
	}
}