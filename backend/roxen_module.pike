#include <module.h>

inherit "module";

constant module_type = MODULE_LOCATION;
constant module_name = "AWML Backend";
constant module_doc = "This module allows running arbitrary backends. Backends are kept alive as long as at least one"
                      " WebSocket is connected.";
constant module_author = "Arne Goedeke <a href=\"mailto:arne@deuso.de\">";

object backend;

void stop() {
    if (backend) backend->shutdown();
    backend = 0;
}

string status() {
    return sprintf("<br>backends: <br><pre>%O</pre>", backend && backend->backends);
}

void create() {
    set_module_url("http://deuso.de");
    defvar("location", Variable.Location("/",
                                         0, "Connection endpoint for js connections", "This is where the "
                                         "module will be inserted in the virtual "
                                         "namespace of your server."));
}

int start(int c, Configuration conf) {
    if (backend) backend->shutdown();
    backend = ((program)"wsjson.pike")();
}

Protocols.WebSocket.Connection websocket_accept(RequestID id, string|void protocol) {
    mapping request_headers = id->request_headers;
    string s = request_headers["sec-websocket-key"] + Protocols.WebSocket.websocket_id;
    mapping heads = ([
        "Upgrade" : "websocket",
        "Connection" : "Upgrade",
        "Sec-Websocket-Accept" : MIME.encode_base64(Crypto.SHA1.hash(s)),
        "Sec-Websocket-Version" : "13",
        "Server" : "Roxen",
    ]);

    mapping rext = ([]);

    if (protocol) heads["Sec-Websocket-Protocol"] = protocol;

    Protocols.WebSocket.Connection ws = Protocols.WebSocket.Connection(id->connection());

    ws->send_raw("HTTP/1.1 101 SwitchingProtocols\r\n");

    foreach (heads; string k; string v) {
      ws->send_raw(sprintf("%s: %s\r\n", k, v));
    }

    ws->send_raw("\r\n");
    ws->ping("");

    return ws;
}

mixed find_file( string f, object id ) {
    NOCACHE();

    mapping request_headers = id->request_headers;

    if (!has_index(request_headers, "sec-websocket-key")) return 0;
    
    object connection = websocket_accept(id, "json");
    id->my_fd = 0;

    object b = backend->get_backend(f + "?" + id->query);

    b->add_websocket(connection);

    return Roxen.http_pipe_in_progress();
} 
