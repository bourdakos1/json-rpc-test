// @ts-check

const { spawn } = require("child_process");
const { nanoid } = require("nanoid");

const lsp = spawn("elyra-pipeline-lsp");

let responseStore = {};
let notifications = [];

let remainder = 0;
let buff = "";

function processMessage(rest) {
  while (remainder > 0) {
    const c = rest.charAt(0);
    rest = rest.substring(1);
    if (c === "") {
      break;
    }
    remainder = remainder - 1;
    buff += c;

    if (remainder === 0) {
      const message = JSON.parse(buff);
      if (message.id !== undefined) {
        responseStore[message.id] = message;
      } else {
        notifications.push(message);
      }

      buff = "";
    }
  }
  return rest;
}

lsp.stdout.on("data", (data) => {
  let rest = processMessage(data.toString());

  const r = /Content-Length: (\d+)\r\n\r\n/;
  const rAll = /Content-Length: (\d+)\r\n\r\n/g;
  const matches = rest.toString().matchAll(rAll);

  for (const match of matches) {
    remainder = match[1];
    rest = rest.replace(r, "");
    rest = processMessage(rest);
  }
});

/**
 * @param {string} method
 * @param {Object} params
 */
function sendNotification(method, params) {
  const message = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
  });

  lsp.stdin.write(`Content-Length: ${message.length}\r\n`);
  lsp.stdin.write("\r\n");
  lsp.stdin.write(message);
}

/**
 * @param {string} method
 * @param {Object} params
 */
function sendRequest(method, params) {
  const id = nanoid();

  const promise = new Promise((resolve) => {
    function handleData() {
      const res = responseStore[id];
      if (res !== undefined) {
        lsp.stdout.removeListener("data", handleData);
        delete responseStore[id];
        resolve(res);
      }
    }
    lsp.stdout.on("data", handleData);
  });

  const message = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });

  lsp.stdin.write(`Content-Length: ${message.length}\r\n`);
  lsp.stdin.write("\r\n");
  lsp.stdin.write(message);

  return promise;
}

async function initialize() {
  await sendRequest("initialize", {});
  sendNotification("initialized", {});
}

/**
 * @param {string} content
 */
async function validate(content) {
  const promise = new Promise((resolve) => {
    function handleData() {
      const notification = notifications.pop();
      if (notification?.method === "textDocument/publishDiagnostics") {
        lsp.stdout.removeListener("data", handleData);
        resolve(notification);
      }
    }
    lsp.stdout.on("data", handleData);
  });

  sendNotification("textDocument/didOpen", {
    textDocument: {
      version: 0,
      text: content,
    },
  });

  return promise;
}

module.exports.initialize = initialize;
module.exports.validate = validate;
