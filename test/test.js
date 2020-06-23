var DAS_Client = require('das-client');

var crestron = new DAS_Client("192.168.1.215");
crestron.on("data", receive_message(data).bind(this));

function receive_message(data){
	//do something with data
	console.log(data);
}