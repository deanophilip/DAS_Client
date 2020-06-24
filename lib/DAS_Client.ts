import { Socket } from "net";
import { Duplex } from "stream";

//import uuid, not @types/uuid
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { v4 as uuidv4 } from "uuid";
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xmlToJsonParser = require("fast-xml-parser");
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonToXmlParser = require("fast-xml-parser").j2xParser;

//interface for the body of the DAS transmission
export interface DAS_body{
	signalType:			string;
	index:				number;
	command:			string;
	value:				string;
}

//interface for the DAS transmission
export interface DAS_transmission{
	bodySize:			number;
	body:				DAS_body;
}

//interface for the root of the DAS transmission
export interface DAS_root{
	DAS_transmission:	DAS_transmission;
}

export class DAS_Client extends Duplex{
	// eslint-disable-next-line @typescript-eslint/no-inferrable-types
	readonly uuid: string = "";
	protected host: string;
	protected port: number;
	private _readingPaused = false;
	protected _socket!: Socket;

	constructor(host: string, port = 64079) {
		super({ objectMode: true });
		this.uuid = uuidv4();
		this.host = host;
		this.port = port;
		this._readingPaused = false;
		this.connect(host = this.host, port = this.port);
	}

	//connect to a new socket, should only be used when the socket is disconnected/destroyed
	connect(host: string, port?: number): DAS_Client {
		this._wrapSocket(new Socket());
		if(port){
			this._socket.connect(port, host);
		}
		else{
			this._socket.connect(this.port, host);
		}
		return this;
	}

	disconnect(): void{
		this._socket.destroy();
		return;
	}

	//uses the events coming from the socket, and forwards them, but customizes the readable event.
	private _wrapSocket(socket: Socket): void {
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

	/**
	 * Creates a private function that handles the incoming socket data and parses the XML into a json format.
	 * Supports back pressure, not that it should be needed.
	 */
	private _onReadable() {
		// Read all the data until one of two conditions is met
		// 1. there is nothing left to read on the socket
		// 2. reading is paused because the consumer is slow
		while (!this._readingPaused) {
			// Without a length parameter, we can then consume the entire input buffer.
			const body = this._socket.read();
	
			// Null body tells us that there is no readable data, and that we can return.
			if (!body) {
				//console.log("Not enough bytes to read based on readableLength: %s", body);
				return;
			}
			
			//first parse XML and convert to JSON for easy manipulation and events
			const options = {
				arrayMode: false
			};
			
			const valid = xmlToJsonParser.validate(body.toString());
			let jsonObj;
			if(valid === true) { //optional (it'll return an object in case it's not valid)
				jsonObj = xmlToJsonParser.parse(body.toString(), options);
				//console.log("XML shifted to JSON: %s", jsonObj);
			}
			else{
				console.log(valid.message);
				this._socket.unshift(body);
				return;
			}

			// Push the data into the read buffer and capture whether
			// we are hitting the back pressure limits
			const pushOk = this.push(jsonObj);
	
			// When the push fails, we need to pause the ability to read
			// messages because the consumer is getting backed up.
			if (!pushOk) this._readingPaused = true;
			return;
		}
	}

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
	_write(obj: DAS_body, encoding: any, cb: ((err?: Error | undefined) => void) | undefined): void {
		const parser = new jsonToXmlParser();
		const xmlBody = parser.parse(obj);
		const xmlBytes = Buffer.byteLength(xmlBody);
		const jsonTrans = {body: obj, bodySize: xmlBytes};
		const jsonRoot: DAS_root = {DAS_transmission: jsonTrans};
		const xml = parser.parse(jsonRoot);
		//console.log(xml);
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


}