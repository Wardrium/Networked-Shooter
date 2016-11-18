import json

def application(environ, start_response):
	start_response('200 OK', [('Content-Type', 'text/html')])

	name = 'anon'
	if environ['REQUEST_METHOD'].upper() == 'POST':
		request_body_size = int(environ['CONTENT_LENGTH'])
		request_body = environ['wsgi.input'].read(request_body_size)
		data = json.loads(request_body)
		name = data['name']
		print name
	
	return "hi"		
	#return ["<h1 style='color:blue'>Hi " + name + ". Are you a cow?</h1>"]
