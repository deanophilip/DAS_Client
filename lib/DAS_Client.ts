import { Socket } from "net";
import { Duplex } from "stream";

//import uuid, not @types/uuid
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uuid = require("uuid");
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xmlToJsonParser = require("fast-xml-parser");
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonToXmlParser = require("fast-xml-parser").j2xParser;

export interface DAS_Body{
	signalType:			string;
	index:				number;
	command:			string;
	value:				string;
}

export interface DAS_Transmission{
	bodySize:			number;
	body:				DAS_Body;
}

export interface DAS_Root{
	DAS_Transmission:	DAS_Transmission;
}

export class DAS_Client extends Duplex{
	// eslint-disable-next-line @typescript-eslint/no-inferrable-types
	private uuid: string = "";
	protected host: string;
	protected port: number;
	private _readingPaused = false;
	protected _socket!: Socket;

	constructor(host: string, port = 64079) {
		super({ objectMode: true });
		this.uuid = new uuid.uuidv4();
		this.host = host;
		this.port = port;
		this._readingPaused = false;
		this.connect(host = this.host, port = this.port);
	}

	connect(host: string, port: number): DAS_Client {
		this._wrapSocket(new Socket());
		this._socket.connect({ host, port });
		return this;
	}
	

	
	_wrapSocket(socket: Socket): void {
		this._socket = socket;
		this._socket.on("close", hadError => this.emit("close", hadError));
		this._socket.on("connect", () => this.emit("connect"));
		this._socket.on("drain", () => this.emit("drain"));
		this._socket.on("end", () => this.emit("end"));
		this._socket.on("error", err => this.emit("error", err));
		this._socket.on("lookup", (err, address, family, host) => this.emit("lookup", err, address, family, host)); // prettier-ignore
		this._socket.on("ready", () => this.emit("ready"));
		this._socket.on("timeout", () => this.emit("timeout"));
		this._socket.on("readable", this._onReadable.bind(this));
	}

	private _onReadable() {
		// Read all the data until one of two conditions is met
		// 1. there is nothing left to read on the socket
		// 2. reading is paused because the consumer is slow
		while (!this._readingPaused) {
			// First step is reading the 32-bit integer from the socket
			// and if there is not a value, we simply abort processing
			
			//let lenBuf = this._socket.read(4);
			const len = this._socket.readableLength;
			if (!len) return;
	
			// Now that we have a length buffer we can convert it
			// into a number by reading the UInt32BE value
			// from the buffer.
			//let len = lenBuf.readUInt32BE();
	
			// ensure that we don't exceed the max size of 256KiB
			if (len > 2 ** 18) {
				this._socket.destroy(new Error("Max length exceeded"));
				console.log("Max length exceeded");
				return;
			}
	
			// With the length, we can then consume the rest of the body.
			const body = this._socket.read(len);
	
			// If we did not have enough data on the wire to read the body
			// we will wait for the body to arrive and push the length
			// back into the socket's read buffer with unshift.
			if (!body) {
				this._socket.unshift(body);
				console.log("Not enough bytes to read based on readableLength");
				return;
			}
			
			//first parse XML and convert to JSON for easy manipulation and events
			const options = {
				arrayMode: false
			};
			
			const valid = xmlToJsonParser.validate(body);
			let jsonObj;
			if(valid === true) { //optional (it'll return an object in case it's not valid)
				jsonObj = xmlToJsonParser.parse(body, options);
			}
			else{
				console.log(valid.message);
				this._socket.unshift(body);
				return;
			}


			// Try to parse the data and if it fails destroy the socket.
			let json;
			try {
				json = JSON.parse(jsonObj);
			} catch (ex) {
				this._socket.destroy(ex);
				console.log(ex.message);
				return;
			}
	

			// Push the data into the read buffer and capture whether
			// we are hitting the back pressure limits
			const pushOk = this.push(json);
	
			// When the push fails, we need to pause the ability to read
			// messages because the consumer is getting backed up.
			if (!pushOk) this._readingPaused = true;
		}
	}

	// _onData(data: DAS_Root[]){
	// 	async.each(data, _dataParser = (response: DAS_Root, callback: any) => {
	// 		var responseArray = response.toString().split(":");
	// 		// responseArray[0] = (config.type ie lightbulbs) : responseArray[1] = (id) : responseArray[2] = (command ie getPowerState) : responseArray[3] = (value)
	// 		if (responseArray[0] != "") {
	// 			this.emit(responseArray[0] + ":" + responseArray[1] + ":" + responseArray[2], parseInt(responseArray[3])); // convert string to value
	// 			//this.log("EMIT: " + responseArray[0] + ":" + responseArray[1] + ":" + responseArray[2] + " = " + responseArray[3]);
	// 		}
	// 		callback();

	// 	}.bind(this), function (err: any) {
	// 		//console.log("SockedRx Processed");
	// 	});
	// }

	/**
	Implements the readable stream method `_read`. This method will
	flagged that reading is no longer paused since this method should
	only be called by a consumer reading data.
	@private
	*/
	_read(): void {
		this._readingPaused = false;
		setImmediate(this._onReadable.bind(this));
	}

	/**
    Implements the writeable stream method `_write` by serializing
    the object and pushing the data to the underlying socket.
	*/
	_write(obj: DAS_Body, encoding: any, cb: ((err?: Error | undefined) => void) | undefined): void {
		const parser = new jsonToXmlParser();
		const xmlBody = parser.parse(obj);
		const xmlBytes = Buffer.byteLength(xmlBody);
		const jsonTrans = {body: obj, bodySize: xmlBytes};
		const jsonRoot: DAS_Root = {DAS_Transmission: jsonTrans};
		const xml = parser.parse(jsonRoot);
		console.log(xml);
		const transBytes = Buffer.byteLength(xml);
		const buffer = Buffer.alloc(transBytes);
		buffer.write(xml, 0);
		this._socket.write(buffer, cb);
	}

	/**
	Implements the writeable stream method `_final` used when
	.end() is called to write the final data to the stream.
	*/
	_final(cb: (() => void) | undefined): void {
		this._socket.end(cb);
		return;
	}








	public setIPAddress(newHost: string): void {
		//close current connection
		this.host = newHost;
		//reset buffers
		//open new connection with new address
	}

	public setPortNumber(newPort: number): void {
		//close current connection
		this.port = newPort;
		//reset buffers
		//open new connection with new address
	}



	// private _connected() {
	// 	this.emit('connect',)
	// }

	// private _connectionClosed() {
		
	// }



}