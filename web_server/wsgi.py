import json

player_info = {}

def application(environ, start_response):
	start_response('200 OK', [('Content-Type', 'text/html')])

	name = 'anon'
	if environ['REQUEST_METHOD'].upper() == 'POST':
		request_body_size = int(environ['CONTENT_LENGTH'])
		request_body = environ['wsgi.input'].read(request_body_size)
		data = json.loads(request_body)
		requestID = data['requestID']

		if requestID == 0:
			name = data['name']
			if name not in player_info:
				player_info[name] = {'x': 0,'y': 0}
			print 'name entered: ' + str(name)
		elif requestID == 1:
			name = data['name']
			position = data['position']
			print str(name) + ' is at position: ' + str(position)
			player_info[name] = position
			for key in player_info:
				print 'viewing key: ' + str(key)
				if key != name:
					print 'found pos of anoher player!'
					response = {'name': key, 'position': player_info[key]}
					return json.dumps(response)
	
	return "not a valid request"
	#return ["<h1 style='color:blue'>Hi " + name + ". Are you a cow?</h1>"]
