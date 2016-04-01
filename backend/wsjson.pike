object port;

mapping connections = ([]);

void incoming(object frame) {
    if (frame->opcode != Protocols.WebSocket.FRAME_TEXT) return;

    string data = frame->text;

    foreach (connections; object con;)
        con->send_text(data);
}

void dummy(object http_request) {
    werror("got http request: %O\n");
}

void close_cb(mixed status, object con) {
    m_delete(connections, con);
}

void accept_cb(array(string) protocols, object request) {
    object con = request->websocket_accept("json");

    connections[con] = 1;

    con->onmessage = incoming;
    con->onclose = close_cb;
}

int main(int argc, array(string) argv) {

    port = Protocols.WebSocket.Port(dummy, accept_cb, 8080);

    return -1;
}
