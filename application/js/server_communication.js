var sc = {
	send_request: function(params, callback){
		var request = cc.loader.getXMLHttpRequest();
		request.open('POST', '/uwsgi');
		request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		request.send(params);

		request.onreadystatechange = function(){
			if (request.readyState == 4 && request.status >= 200 && request.status <= 207){
				var httpStatus = request.statusText;

				console.log("Response: " + request.responseText);
				//if (callback != null){
					//callback.perform(request.responseText);
				//}
			}
		};
		return true;
	},
};