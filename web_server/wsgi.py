import json
import uwsgi
from numpy.random import randint

class PlayerManager:
	def __init__(self):
		self.players = {}	# Dictionary of uniqueID to a player in the players list.
		self.IDCounter = 0

	def addPlayer(self, name):
		ID = self.generateID()
		position = self.generateStartLocation()
		self.players[ID] = {'name': name, 'position': position}

		return str(ID), self.getPlayers()

	def generateID(self):
		self.IDCounter += 1

		return self.IDCounter

	def generateStartLocation(self):
		x_pos = randint(600)
		y_pos = randint(600)

		return {'x': x_pos, 'y': y_pos}

	def getPlayers(self):
		return self.players

	def setPlayerPosition(self, ID, position):
		self.players[int(ID)]['position'] = position

REQ_ID = {
	'register_name': 0,
	'update_position': 1,
}

pm = PlayerManager()

def application(env, start_response):
	# Open websocket connection
	uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'], env.get('HTTP_ORIGIN', ''))
	while True:
		data = uwsgi.websocket_recv()
		response = processData(data)
		uwsgi.websocket_send(response)

def processData(data):
	data = json.loads(data)		# Load from json format into dictionary.
	requestID = data['requestID']

	if requestID == REQ_ID['register_name']:
		name = data['name']
		ID, players = pm.addPlayer(name)
		response = {'ID': ID, 'players': players}
	elif requestID == REQ_ID['update_position']:
		ID = data['ID']
		position = data['position']
		pm.setPlayerPosition(ID, position)
		response = {'players': pm.getPlayers()}

	return json.dumps(response)