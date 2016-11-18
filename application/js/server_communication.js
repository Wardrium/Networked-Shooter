var sc = {
	send: {
		name: function(params){
			params['requestID'] = 0;
			_sendRequest(params);
		},
		position: function(params, callback){
			params['requestID'] = 1;
			_sendRequest(params, callback);
		},
	}
};

function _sendRequest(params, callback){
	var request = cc.loader.getXMLHttpRequest();
	request.open('POST', '/uwsgi');
	request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
	request.send(JSON.stringify(params));

	request.onreadystatechange = function(){
		if (request.readyState == 4 && request.status >= 200 && request.status <= 207){
			var httpStatus = request.statusText;
			if (callback != null){
				console.log(JSON.parse(request.responseText));
				if (request.responseText !== 'not a valid request')
					callback(JSON.parse(request.responseText));
			}
		}
	};
};