module.exports = function(RED) {
  // https://github.com/axios/axios
const fs = require('fs');
const https = require('https');
const axios = require("axios");
const mustache = require("mustache");
const WebSocket = require('ws');
class GraphQLError {};
class EventError {};

const GQL = {
  CONNECTION_INIT: 'connection_init',
  CONNECTION_ACK: 'connection_ack',
  CONNECTION_ERROR: 'connection_error',
  CONNECTION_KEEP_ALIVE: 'ka',
  START: 'subscribe',
  STOP: 'stop',
  CONNECTION_TERMINATE: 'connection_terminate',
  DATA: 'next',
  ERROR: 'error',
  COMPLETE: 'complete'
}

class Subscriber {
  constructor (url, options, callback, protocols = 'graphql-ws', transformedFilePath_ws) {
    this.callback = callback

    this.nextId = 1
    this.subscriptions = new Map()
    this.webSocket = new WebSocket(url, protocols, {
            ca: fs.readFileSync(transformedFilePath_ws), // Path to CA certificate file
            rejectUnauthorized: true // Enable certificate verification
        });

    this.webSocket.onopen = event => {
      // Initiate the connection
      this.webSocket.send(JSON.stringify({
        type: GQL.CONNECTION_INIT,
        payload: options
      }))
    }

    this.webSocket.onclose = event => {
      // The code 1000 (Normal Closure) is special, and results in no error or payload.
      const error = event.code === 1000 ? null : new EventError(event)
      // Notify the subscriber.
      this.callback(error)
      // Notify the subscriptions.
      const callbacks = Array.from(this.subscriptions.values())
      this.subscriptions.clear()
      for (const callback of callbacks) {
        callback(error, null)
      }
    }

    this.webSocket.onmessage = this.onMessage.bind(this)
  }

  subscribe (query, variables, operationName, callback) {
    const id = (this.nextId++).toString()
    this.subscriptions.set(id, callback)

    this.webSocket.send(JSON.stringify({
      type: GQL.START,
      id,
      payload: { query, variables, operationName }
    }))

    // Return the unsubscriber.
    return () => {
      this.subscriptions.delete(id)

      this.webSocket.send(JSON.stringify({
        type: GQL.STOP,
        id
      }))
    }
  }

  shutdown () {
    this.webSocket.send(JSON.stringify({
      type: GQL.CONNECTION_TERMINATE
    }))
    this.webSocket.close()
  }

  onMessage (event) {
    const data = JSON.parse(event.data)

    switch (data.type) {
      case GQL.CONNECTION_ACK: {
        // This is the successful response to GQL.CONNECTION_INIT
        if (this.callback) {
          this.callback(null, this.subscribe.bind(this))
        }
        break
      }
      case GQL.CONNECTION_ERROR: {
        // This may occur:
        // 1. In response to GQL.CONNECTION_INIT
        // 2. In case of parsing errors in the client which will not disconnect.
        if (this.callback) {
          this.callback(new GraphQLError(data.payload), this)
        }
        break
      }
      case GQL.CONNECTION_KEEP_ALIVE: {
        // This may occur:
        // 1. After GQL.CONNECTION_ACK,
        // 2. Periodically to keep the connection alive.
        break
      }
      case GQL.DATA: {
        // This message is sent after GQL.START to transfer the result of the GraphQL subscription.
        const callback = this.subscriptions.get(data.id)
        if (callback) {
          const error = data.payload.errors ? new GraphQLError(data.payload.errors) : null
          callback(error, data.payload.data)
        }
        break
      }
      case GQL.ERROR: {
        // This method is sent when a subscription fails. This is usually dues to validation errors
        // as resolver errors are returned in GQL.DATA messages.
        const callback = this.subscriptions.get(data.id)
        if (callback) {
          callback(new GraphQLError(data.payload), null)
        }
        break
      }
      case GQL.COMPLETE: {
        // This is sent when the operation is done and no more dta will be sent.
        const callback = this.subscriptions.get(data.id)
        if (callback) {
          this.subscriptions.delete(data.id)
          // Return a null error and payload to indicate the subscription is closed.
          callback(null, null)
        }
        break
      }
    }
  }
}

function graphQLSubscriber (url, options, callback, protocols = 'graphql-ws', transformedFilePath_ws) {
  const subscriber = new Subscriber(url, options, callback, protocols, transformedFilePath_ws)
  return subscriber.shutdown.bind(subscriber)
}


var vers = "2.1.2";

  function isReadable(value) {
    return typeof value === 'object' && typeof value._read === 'function' && typeof value._readableState === 'object'
  }

  function safeJSONStringify(input, maxDepth) {
    var output,
      refs = [],
      refsPaths = [];

    maxDepth = maxDepth || 5;

    function recursion(input, path, depth) {
      var output = {},
        pPath,
        refIdx;

      path = path || "";
      depth = depth || 0;
      depth++;

      if (maxDepth && depth > maxDepth) {
        return "{depth over " + maxDepth + "}";
      }

      for (var p in input) {
        pPath = (path ? path + "." : "") + p;
        if (typeof input[p] === "function") {
          output[p] = "{function}";
        } else if (input[p] && Buffer.isBuffer(input[p])) {
          output[p] = "[object Buffer]";
        } else if (input[p] && isReadable(input[p])) {
          output[p] = "[object Readable]";
        } else if (typeof input[p] === "object") {
          refIdx = refs.indexOf(input[p]);

          if (-1 !== refIdx) {
            output[p] = "{reference to " + refsPaths[refIdx] + "}";
          } else {
            refs.push(input[p]);
            refsPaths.push(pPath);
            output[p] = recursion(input[p], pPath, depth);
          }
        } else {
          output[p] = input[p];
        }
      }

      return output;
    }

    if (typeof input === "object") {
      output = recursion(input);
    } else {
      output = input;
    }

    return JSON.stringify(output);
  }

  function GraphqlNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    RED.log.debug("--- GraphqlNode v" + vers + " ---");
    RED.log.debug("GraphqlNode node: " + safeJSONStringify(node));
    RED.log.trace("GraphqlNode config: " + safeJSONStringify(config));
    node.endpoint = config.endpoint;
	node.ws_endpoint = config.ws_endpoint;
	node.caCertPath = config.caCertPath;
    node.token = config.token
    RED.log.debug("node.endpoint: " + node.endpoint);
	RED.log.debug("node.ws_endpoint: " + node.ws_endpoint); // Log ws_endpoint
	RED.log.debug("node.caCertPath: " + node.caCertPath);
    RED.log.debug("node.token: " + node.token)
  }

  RED.nodes.registerType("graphql-server", GraphqlNode, {
    credentials: {
      token: { type: "password" },
    }
  });

  function ReadWrite_Tag(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.graphqlConfig = RED.nodes.getNode(config.graphql);  // Retrieve the config node
    node.template = config.template;
    node.name = config.name;
    node.varsField = config.varsField || "variables";
    node.syntax = config.syntax || "mustache";
    node.showDebug = config.showDebug || false;
    node.token = (node.credentials && node.credentials.token) || ""; // Check if node.credentials exists before accessing token
    node.caCertPath = config.caCertPath || "";
	node.customHeaders = config.customHeaders || {};
    node.varsField = config.varsField || "variables";
    RED.log.debug("--- GraphqlExecNode ---");

    if (!node.graphqlConfig) {
        node.error("Invalid graphql config");
        return; // Exit early if config is invalid
    }

    function dataobject(context, msg){
      data = {}
      data.msg = msg;
      data.global = {};
      data.flow = {};
      g_keys = context.global.keys();
      f_keys = context.flow.keys();
      for (k in g_keys){
        data.global[g_keys[k]] = context.global.get(g_keys[k]);
      };
      for (k in f_keys){
        data.flow[f_keys[k]] = context.flow.get(f_keys[k]);
      };
      return data
    }

function callGraphQLServer(query, variables = {}, customHeaders = {}) {
    let data = dataobject(node.context(), node.msg);
    let url = mustache.render(node.graphqlConfig.endpoint, data);
    let headers = customHeaders;
    let cert = node.caCertPath || node.graphqlConfig.caCertPath || "";
    const token = node.token || node.graphqlConfig.token || "";
    var transformedFilePath = cert.replace('C:\\fakepath\\', '.node-red\\');

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    if (node.showDebug) {
        node.log(safeJSONStringify(data));
        node.log(headers.Authorization);
    }

    axios({
        method: "POST",
        url,
        headers,
        timeout: 20000,
        data: {
            query: query,
            variables: variables
        },
        httpsAgent: new https.Agent({ ca: fs.readFileSync(transformedFilePath) })
        //rejectUnauthorized: false  // Ignore certificate validation
    })
    .then(function(response) {
        switch (true) {
            case response.status == 200 && !response.data.errors:
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: RED._("graphql.status.success")
                });
                node.msg.payload = node.msg.payload || {}; // Ensure node.msg.payload is initialized
                node.msg.payload.graphql = response.data.data; // remove .data to see entire response
                if (node.showDebug) {
                    node.msg.debugInfo = {
                        data: response.data,
                        headers,
                        query,
                        variables
                    };
                }
                node.send(node.msg);
                break;
            case response.status == 200 && !!response.data.errors:
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: RED._("graphql.status.gqlError")
                });
                node.msg.payload.graphql = response.data.errors;
                node.send([null, node.msg]);
                break;
            default:
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "status: " + response.status
                });
                node.msg.payload.graphql = {
                    statusCode: response.status,
                    body: response.data
                };
                node.send([null, node.msg]);
                break;
        }
    })
    .catch(function(error) {
        RED.log.debug("error:" + error);
        node.status({ fill: "red", shape: "dot", text: "error" });
        node.msg.payload = node.msg.payload || {}; // Ensure node.msg.payload is initialized
        node.msg.payload.graphql = { error };
        node.error("error: " + error);
        node.send([null, node.msg]);
    });
}

  node.on("input", function(msg) {
    try {
        RED.log.debug("--- on(input) ---");
        RED.log.debug("msg: " + safeJSONStringify(msg));

        // Ensure msg is not empty
        if (!msg) {
            throw new Error("Received empty message");
        }
var tokenget = node.context().flow.get("token");

// Check if the tokenpass1 value is defined
if (tokenget !== undefined) {
    // Use the tokenpass1 value as needed
    // For example:

} else {
    // Handle the case where tokenpass1 is not defined in the flow context
    node.warn("Token not found in flow context");
}
       
     
        // Assign message to node.msg
        node.msg = msg;

        // Check if msg.template is defined, otherwise use the default node.template
        node.template = msg.template !== undefined ? msg.template : node.template;

        // Check if msg.syntax is defined, otherwise use the default node.syntax
        node.syntax = msg.syntax !== undefined ? msg.syntax : node.syntax;

        // Merge msg.customHeaders with node.customHeaders, handling undefined cases
        if (tokenget.customHeaders !== undefined && typeof tokenget.customHeaders === "object") {
            // Merge msg.customHeaders with node.customHeaders
            node.customHeaders = { ...node.customHeaders, ...tokenget.customHeaders };
        }

        var query;
        if (node.syntax === "mustache") {
            query = mustache.render(node.template, msg);
        } else {
            query = node.template;
        }
        var variables = msg[node.varsField] || {};

        // Call the function to execute the GraphQL query
        callGraphQLServer(query, variables, node.customHeaders);
    } catch (error) {
        // Handle errors here
        node.error("Error occurred: " + error.message);
        node.status({ fill: "red", shape: "dot", text: "Error: " + error.message });
        node.send([null, { error: error.message }]); // Optionally, send the error downstream
    }
});


    node.on("close", function() {
      RED.log.debug("--- closing node ---");
      node.graphqlConfig.credentials.token = node.token || "";
      RED.nodes.addCredentials(
        node.graphqlConfig,
        node.graphqlConfig.credentials
      );
    });
  }

  RED.nodes.registerType("ReadWrite_Tag", ReadWrite_Tag, {
    credentials: {
      token: { type: "password" },
    }
  });
  
    function GraphqlLogin(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.graphqlConfig = RED.nodes.getNode(config.graphql);  // Retrieve the config node

    node.template = config.template;
    node.name = config.name;
    node.varsField = config.varsField || "variables";
    node.syntax = config.syntax || "mustache";
    node.showDebug = config.showDebug || false;
    node.token = ""; // Check if node.credentials exists before accessing token
	node.username = (node.credentials && node.credentials.username) || ""; // 
	node.password = (node.credentials && node.credentials.password) || ""; // 
    node.customHeaders = config.customHeaders || {};
    node.varsField = config.varsField || "variables";
    RED.log.debug("--- GraphqlExecNode ---");

    if (!node.graphqlConfig) {
        node.error("Invalid graphql config");
        return; // Exit early if config is invalid
    }

    function dataobject(context, msg){
      data = {}
      data.msg = msg;
      data.global = {};
      data.flow = {};
      g_keys = context.global.keys();
      f_keys = context.flow.keys();
      for (k in g_keys){
        data.global[g_keys[k]] = context.global.get(g_keys[k]);
      };
      for (k in f_keys){
        data.flow[f_keys[k]] = context.flow.get(f_keys[k]);
      };
      return data
    }

function callGraphQLServer(query, variables = {}, customHeaders = {}) {
  let data = dataobject(node.context(), node.msg);
  let url = mustache.render(node.graphqlConfig.endpoint, data);
  let headers = customHeaders;
  let cert = node.caCertPath || node.graphqlConfig.caCertPath || "";
  var transformedFilePath = cert.replace('C:\\fakepath\\', '.node-red\\');

  if (node.showDebug) {
    node.log(safeJSONStringify(data));
    node.log(headers.Authorization);
  }

  axios({
    method: "POST",
    url,
    headers,
    timeout: 20000,
    data: {
      query: query,
      variables: variables
    },
    httpsAgent: new https.Agent({ ca: fs.readFileSync(transformedFilePath) })
  })
  .then(function(response) {
    switch (true) {
      case response.status == 200 && !response.data.errors:
        node.status({
          fill: "green",
          shape: "dot",
          text: RED._("graphql.status.success")
        });

        if (!node.msg.payload) {
          node.msg.payload = {};
        }
        
        node.msg.payload.graphql = {
          customHeaders: {
            Authorization: "Bearer " + response.data.data.session.token
          }
        };

        if (node.showDebug) {
          node.msg.debugInfo = {
            data: response.data,
            headers,
            query,
            variables
          };
        }

        node.send(node.msg);

        var tokenpass1 = node.msg.payload.graphql;
        node.context().flow.set("token", tokenpass1);

        break;

      case response.status == 200 && !!response.data.errors:
        node.status({
          fill: "yellow",
          shape: "dot",
          text: RED._("graphql.status.gqlError")
        });
        node.msg.payload.graphql = response.data.errors;
        node.send([null, node.msg]);
        break;

      default:
        node.status({
          fill: "red",
          shape: "dot",
          text: "status: " + response.status
        });
        node.msg.payload.graphql = {
          statusCode: response.status,
          body: response.data
        };
        node.send([null, node.msg]);
        break;
    }
  })
  .catch(function(error) {
    RED.log.debug("error:" + error);
    node.status({ fill: "red", shape: "dot", text: "error" });

    if (!node.msg.payload) {
      node.msg.payload = {};
    }

    node.msg.payload.graphql = { error };
    node.error("error: " + error);
    node.send([null, node.msg]);
  });
}

node.on("input", function(msg) {
    RED.log.debug("--- on(input) ---");
    RED.log.debug("msg: " + safeJSONStringify(msg));
    node.msg = msg;

    
    // Construct the GraphQL mutation query with the username and password
    var query = `
        mutation {
            session: login(username: "${node.username}", password: "${node.password}") {
                token
            }
        }
    `;

    // Variables can be passed if needed, depending on your GraphQL schema
    var variables = {};

    // Call the function to execute the GraphQL mutation
    callGraphQLServer(query, variables, node.customHeaders);
});

    node.on("close", function() {
    RED.log.debug("--- closing node ---");

    // Check if node.graphqlConfig is defined and has credentials object
    if (node.graphqlConfig && node.graphqlConfig.credentials) {
        // Assign token, username, and password only if they are defined
        if (node.token !== undefined) {
            node.graphqlConfig.credentials.token = node.token;
        }
        if (node.username !== undefined) {
            node.graphqlConfig.credentials.username = node.username;
        }
        if (node.password !== undefined) {
            node.graphqlConfig.credentials.password = node.password;
        }

        // Add updated credentials to the configuration node
        RED.nodes.addCredentials(
            node.graphqlConfig,
            node.graphqlConfig.credentials
        );
    } else {
        RED.log.warn("GraphQL configuration or credentials not found.");
    }
});

  }
  
   RED.nodes.registerType("Unified Login", GraphqlLogin, {
    credentials: {
      token: { type: "password" },
	  username: { type: "text" },
	  password: { type: "text" }
    }
  });
  
function SUBCRIBE_TagValue(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    // Retrieve the configuration node
    node.graphqlConfig = RED.nodes.getNode(config.graphql);

    // Retrieve node properties
    node.template = config.template;
    node.name = config.name;
    node.varsField = config.varsField || "variables";
    node.syntax = config.syntax || "mustache";
    node.showDebug = config.showDebug || false;
    node.token = (node.credentials && node.credentials.token) || ""; // Check if node.credentials exists before accessing token
    node.customHeaders = config.customHeaders || {};
  

    // Check if the configuration node is valid
    if (!node.graphqlConfig) {
        node.error("Invalid graphql config");
        return; // Exit early if config is invalid
    }

    let wsConnection; // Variable to store the WebSocket connection

    // Function to create WebSocket instance and subscribe to GraphQL server
    function createWebSocketAndSubscribe() {
        let data = dataobject(node.context(), node.msg);
        let url = mustache.render(node.graphqlConfig.ws_endpoint, data);
        let options = node.customHeaders;
        let query = node.template;
        let subsProtocol = 'graphql-transport-ws';
        let cert_ws = node.caCertPath || (node.graphqlConfig && node.graphqlConfig.caCertPath) || "";
        
        if (!cert_ws) {
            node.error("CA certificate path is not defined");
            return;
        }
        var transformedFilePath_ws = cert_ws.replace('C:\\fakepath\\', '.node-red\\');

        wsConnection = graphQLSubscriber(url, options, (error, subscribe) => {
            if (error) {
                console.error("WebSocket connection error:", error);
                node.error("WebSocket connection error: " + error);
                return;
            }

            // Subscribe to the GraphQL query
            subscribe(query, {}, null, (error, response) => {
                if (error) {
                    console.error("Subscription error:", error);
                    node.error("Subscription error: " + error);
                    return;
                }

                // Handle the response data
                if (response && response.tagValues && response.tagValues.value && response.tagValues.value.value !== undefined) {
                    const newData = response.tagValues.value.value;
                    node.send({ payload: newData }); // Emit the data
		node.status({
                fill: "green",
                shape: "dot",
                text: RED._("subscribe.success")
              });
                } else {
                    console.error("Invalid response format or missing data");
                    node.error("Invalid response format or missing data");
                }
            });
        }, subsProtocol, transformedFilePath_ws);
    }

    // Function to extract data from context and message objects
    function dataobject(context, msg) {
        let data = {
            msg: msg,
            global: {},
            flow: {}
        };

        let g_keys = context.global.keys();
        let f_keys = context.flow.keys();

        g_keys.forEach(key => {
            data.global[key] = context.global.get(key);
        });

        f_keys.forEach(key => {
            data.flow[key] = context.flow.get(key);
        });

        return data;
    }

    // Handle input message
    node.on("input", function(msg) {
    try {
        // Ensure msg is not empty
        if (!msg) {
            throw new Error("Received empty message");
        }
var tokenget = node.context().flow.get("token");

// Check if the tokenpass1 value is defined
if (tokenget !== undefined) {
    // Use the tokenpass1 value as needed
    // For example:

} else {
    // Handle the case where tokenpass1 is not defined in the flow context
    node.warn("Token not found in flow context");
}
        // Assign message to node.msg
        node.msg = tokenget;

        // Check if msg.template is defined, otherwise use the default node.template
        node.template = (tokenget.template !== undefined) ? tokenget.template : node.template;

        // Check if msg.syntax is defined, otherwise use the default node.syntax
        node.syntax = (tokenget.syntax !== undefined) ? tokenget.syntax : node.syntax;

        // Merge msg.customHeaders with node.customHeaders, handling undefined cases
        if (tokenget.customHeaders && typeof tokenget.customHeaders === "object") {
            node.customHeaders = { ...node.customHeaders, ...tokenget.customHeaders };
        }

        // Create WebSocket connection and subscribe
        createWebSocketAndSubscribe();
    } catch (error) {
        // Handle errors here
        node.error("Error occurred: " + error.message);
        node.status({ fill: "red", shape: "dot", text: "Error: " + error.message });
        node.send([null, { error: error.message }]); // Optionally, send the error downstream
    }
});

    // Handle node closure
    node.on("close", function() {
        // Close the WebSocket connection when the node is closed
        if (wsConnection) {
            wsConnection.close();
        }
    });
}

RED.nodes.registerType("SUBCRIBE_TagValue", SUBCRIBE_TagValue, {
    credentials: {
        token: { type: "password" },
    }
});

function SUBCRIBE_AlarmID(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    // Retrieve the configuration node
    node.graphqlConfig = RED.nodes.getNode(config.graphql);

    // Retrieve node properties
    node.template = config.template;
    node.name = config.name;
    node.varsField = config.varsField || "variables";
    node.syntax = config.syntax || "mustache";
    node.showDebug = config.showDebug || false;
    node.token = (node.credentials && node.credentials.token) || ""; // Check if node.credentials exists before accessing token
    node.customHeaders = config.customHeaders || {};
  

    // Check if the configuration node is valid
    if (!node.graphqlConfig) {
        node.error("Invalid graphql config");
        return; // Exit early if config is invalid
    }

    let wsConnection; // Variable to store the WebSocket connection

    // Function to create WebSocket instance and subscribe to GraphQL server
    function createWebSocketAndSubscribe() {
        let data = dataobject(node.context(), node.msg);
        let url = mustache.render(node.graphqlConfig.ws_endpoint, data);
        let options = node.customHeaders;
        let query = node.template;
        let subsProtocol = 'graphql-transport-ws';
        let cert_ws = node.caCertPath || (node.graphqlConfig && node.graphqlConfig.caCertPath) || "";
        
        if (!cert_ws) {
            node.error("CA certificate path is not defined");
            return;
        }
        var transformedFilePath_ws = cert_ws.replace('C:\\fakepath\\', '.node-red\\');

        wsConnection = graphQLSubscriber(url, options, (error, subscribe) => {
            if (error) {
                console.error("WebSocket connection error:", error);
                node.error("WebSocket connection error: " + error);
                return;
            }

            // Subscribe to the GraphQL query
            subscribe(query, {}, null, (error, response) => {
                if (error) {
                    console.error("Subscription error:", error);
                    node.error("Subscription error: " + error);
                    return;
                }

                // Handle the response data
                if (response && response.activeAlarms !== undefined && response.activeAlarms.state !== undefined) {
    const newData = response.activeAlarms.state;
    const newData2 = response.activeAlarms.value;

    // Emit newData to output 1
    node.send({ payload: newData });
	node.status({
                fill: "green",
                shape: "dot",
                text: RED._("subscribe.success")
              });
    // Check if newData2 is not undefined before sending to output 2
    if (newData2 !== undefined) {
        node.send([null, { payload: newData2 }]);
    } else {
        console.log("newData2 is undefined, not sending to output 2");
    }
} else {
    console.error("Invalid response format or missing data");
    node.error("Invalid response format or missing data");
}
            });
        }, subsProtocol, transformedFilePath_ws);
    }

    // Function to extract data from context and message objects
    function dataobject(context, msg) {
        let data = {
            msg: msg,
            global: {},
            flow: {}
        };

        let g_keys = context.global.keys();
        let f_keys = context.flow.keys();

        g_keys.forEach(key => {
            data.global[key] = context.global.get(key);
        });

        f_keys.forEach(key => {
            data.flow[key] = context.flow.get(key);
        });

        return data;
    }

    // Handle input message
    node.on("input", function(msg) {
    try {
        // Ensure msg is not empty
        if (!msg) {
            throw new Error("Received empty message");
        }
var tokenget = node.context().flow.get("token");

// Check if the tokenpass1 value is defined
if (tokenget !== undefined) {
    // Use the tokenpass1 value as needed
    // For example:

} else {
    // Handle the case where tokenpass1 is not defined in the flow context
    node.warn("Token not found in flow context");
}
        // Assign message to node.msg
        node.msg = tokenget;

        // Check if msg.template is defined, otherwise use the default node.template
        node.template = (tokenget.template !== undefined) ? tokenget.template : node.template;

        // Check if msg.syntax is defined, otherwise use the default node.syntax
        node.syntax = (tokenget.syntax !== undefined) ? tokenget.syntax : node.syntax;

        // Merge msg.customHeaders with node.customHeaders, handling undefined cases
        if (tokenget.customHeaders && typeof tokenget.customHeaders === "object") {
            node.customHeaders = { ...node.customHeaders, ...tokenget.customHeaders };
        }

        // Create WebSocket connection and subscribe
        createWebSocketAndSubscribe();
    } catch (error) {
        // Handle errors here
        node.error("Error occurred: " + error.message);
        node.status({ fill: "red", shape: "dot", text: "Error: " + error.message });
        node.send([null, { error: error.message }]); // Optionally, send the error downstream
    }
});

    // Handle node closure
    node.on("close", function() {
        // Close the WebSocket connection when the node is closed
        if (wsConnection) {
            wsConnection.close();
        }
    });
}

RED.nodes.registerType("SUBCRIBE_AlarmID", SUBCRIBE_AlarmID, {
    credentials: {
        token: { type: "password" },
    }
});

};
