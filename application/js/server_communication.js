var sc_ref;	// Need self reference for when setting websocket functions.
sc = {
	ref: this,	
	REQ_ID: {
		register_name: 0,
		update_position: 1,
	},
	openConnection: function(operator, data, callback){
		this.ws = new WebSocket('ws://98.243.38.5/uwsgi');
		sc_ref = this;
		this.ws.onopen = function(){
			sc_ref.sendData(operator, data);
		};
		this.setOnMessage(callback);
		this.ws.onclose = function(){
			console.log("socket closed");
		}
	},
	setOnMessage(callback){
		sc_ref = this;
		this.ws.onmessage = function(evt){
			sc_ref.receiveData(evt, callback);
		}
	},
	sendData: function(operator, data){
		data['requestID'] = operator;
		this.ws.send(JSON.stringify(data));
	},
	receiveData: function(evt, callback){
		var responseData = evt.data;
		callback(JSON.parse(responseData));
	},
};