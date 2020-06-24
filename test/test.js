//JS include for the client
var DAS_Client = require('das-client').DAS_Client;
//var DAS_Root = require('das-client').DAS_Root;

async function run() {  
	//create new instance of client (connects to the host in the constructor)
	let crestron = new DAS_Client("192.168.1.215", 64079);

	//add callbacks to events
	//called when the socket connects
	crestron.on("connect", () => connected());
	//called when the socket closes
	crestron.on('close', () => closedConnection());
	//called when theres an error
	crestron.on('error', console.error);
	//called when data is read from the socket and ready to be used
	crestron.on('data', d => receive_message(d));

	//function called when new data is read from "data" event
	function receive_message(data){
		//do something with data
		console.log("Received data: ")
		//the JS object containing the transmission
		console.log(data);
		//the body of the transmission
		console.log(data.DAS_transmission.body);
		//the signal
		console.log(data.DAS_transmission.body.signalType);
		//the index
		console.log(data.DAS_transmission.body.index);
		//the command
		console.log(data.DAS_transmission.body.signalType);
		//the value
		console.log(data.DAS_transmission.body.value);

		//function that can be used to write a message back to crestron using the same JS object notation as above.
		//crestron.write(data.DAS_transmission.body);
	}

	//called when connected to Crestron from "connect" event
	function connected() {
		console.log('Connected to Crestron Machine');
	}

	//called when a connection is closed from "close" event, and a reconnection is attempted
	function closedConnection(){
		console.log('Connection closed');
		// Handle error properly

		// Reconnect
		try {
			setTimeout(() => crestron.connect("192.168.1.215"), 20000);
		} catch (err) {
			console.log(err);
		}
	}
}
//runs the function created above, and catches errors to error out the console
run().catch(console.error);