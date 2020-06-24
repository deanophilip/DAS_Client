/// <reference types="node" />
import { Socket } from "net";
import { Duplex } from "stream";
export interface DAS_body {
    signalType: string;
    index: number;
    command: string;
    value: string;
}
export interface DAS_transmission {
    bodySize: number;
    body: DAS_body;
}
export interface DAS_root {
    DAS_transmission: DAS_transmission;
}
export declare class DAS_Client extends Duplex {
    readonly uuid: string;
    protected host: string;
    protected port: number;
    private _readingPaused;
    protected _socket: Socket;
    constructor(host: string, port?: number);
    connect(host: string, port?: number): DAS_Client;
    disconnect(): void;
    private _wrapSocket;
    /**
     * Creates a private function that handles the incoming socket data and parses the XML into a json format.
     * Supports back pressure, not that it should be needed.
     */
    private _onReadable;
    /**
    Implements the readable stream method `_read`. This method will
    flagged that reading is no longer paused since this method should
    only be called by a consumer reading data.
    @private
    */
    _read(): void;
    /**
    Implements the writeable stream method `_write` by serializing
    the object and pushing the data to the underlying socket.
    */
    _write(obj: DAS_body, encoding: any, cb: ((err?: Error | undefined) => void) | undefined): void;
    /**
    Implements the writeable stream method `_final` used when
    .end() is called to write the final data to the stream.
    */
    _final(cb: (() => void) | undefined): void;
}
