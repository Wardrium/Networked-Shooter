from cgi import parse_qs

def application(environ, start_response):
	start_response('200 OK', [('Content-Type', 'text/html')])

	name = 'anon'
	if environ['REQUEST_METHOD'].upper() == 'POST':
		request_body_size = int(environ['CONTENT_LENGTH'])
		request_body = environ['wsgi.input'].read(request_body_size)
		data = parse_qs(request_body)
		name = data['name'][0]
			
	return ["<h1 style='color:blue'>Hi " + name + ". Are you a cow?</h1>"]
