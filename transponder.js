var Protocol = require('pomelo-protocol');
var net = require('net');
var Package = Protocol.Package;
var Message = Protocol.Message;
var commandDecoder = require('./commandDecoder.js');
var OnlineClients = require('./OnlineHolder.js');
var MyProtocol = require('./protocol.js');
var logger = require('./logger');

var params = {host: "121.40.53.201", port: "3010"};
var handshakeBuffer = {
	'sys': {type: 'socket', version: '0.0.1'},
	'user': {}
};
var socket = new net.Socket();
socket.binaryType = 'arraybuffer';

logger.info('正在向中央服务(' + params.host + ':' + params.port + ')发起连接中....');
socket.connect(params.port, params.host, function () {
	logger.info('与中央服务器连接成功，发送握手信号...');
	var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer)));
	socket.write(obj);
});

socket.on('data', function (data) {
	var da = Package.decode(data);
	if (da.type == Package.TYPE_HANDSHAKE) {
		logger.info('收到握手信号，握手成功');
		var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
		socket.write(obj);
	}

	if (da.type == Package.TYPE_DATA) {
		var s = da.body.toString('utf-8');
		s = s.replace('onMsg', '');
		s = s.replace('{', '');
		s = s.replace('}', '');
		var array = s.split(',');

		var command = '';
		var ipAddress = '';
		var port = '';
		var serialno = '';
		var data = '';
		for (var i = 0; i < array.length; i++) {
			if (array[i].indexOf('command') > 0) {
				var content = array[i].split(":")[1];
				command = content.replace("\"", '').replace("\"", '');
			} else if (array[i].indexOf('ipAddress') > 0) {
				var content = array[i].split(":")[1];
				ipAddress = content.replace("\"", '').replace("\"", '');
			} else if (array[i].indexOf('port') > 0) {
				var content = array[i].split(":")[1];
				port = content.replace("\"", '').replace("\"", '');
			} else if (array[i].indexOf('serialNo') > 0) {
				var content = array[i].split(":")[1];
				serialno = content.replace("\"", '').replace("\"", '');
			} else if (array[i].indexOf('data') > 0) {
				var content = array[i].split(":")[1];
				data = content.replace("\"", '').replace("\"", '');
			}
		}
		if(command != "2005" && command != "4000") {
			logger.warn("收到数据:command:" + command);
			logger.warn("收到数据:ipAddress:" + ipAddress);
			logger.warn("收到数据:port:" + port);
			logger.warn("收到数据:serialno:" + serialno);
			logger.warn("收到数据:data:" + data);
		}
		// 设备状态查询
		if (command == '2000') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0004', '0001', '2000', '', '36FF');
			client.sock.write(new Buffer(answerBytes));
		} else if (command == '2001') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0004', '0001', '2001', '', '36FF');
			client.sock.write(new Buffer(answerBytes));
		} else if (command == '2002') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0005', '0001', '2002', data, '36FF');
			client.sock.write(new Buffer(answerBytes));
		} else if (command == '2005') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			if(!!client) {
				var answerBytes = MyProtocol.encode(client.code, '0000', '0005', '0001', '2005', data, '36FF');
				client.sock.write(new Buffer(answerBytes));
			}
		} else if (command == '3000') {
			console.log(ipAddress + "________" + port);
			OnlineClients.debug();
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0030', '0001', '3000', data, '36FF');
			client.sock.write(new Buffer(answerBytes));
		} else if (command == '3007') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			data = commandDecoder.trim(data);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0008', '0001', '3007', data, '36FF');
			client.sock.write(new Buffer(answerBytes));
		} else if (command == '3008') {
			var client = OnlineClients.getByClientId(ipAddress + ":" + port);
			data = commandDecoder.trim(data);
			var answerBytes = MyProtocol.encode(client.code, '0000', '0007', '0001', '3008', data, '36FF');
			client.sock.write(new Buffer(answerBytes));
		}
	}
	if (da.type == Package.TYPE_HEARTBEAT) {
		/**
		 * 收到心跳信号，30秒发送心跳信号
		 */
		setTimeout(function () {
			var hb = Package.encode(Package.TYPE_HEARTBEAT);
			socket.write(hb);
		}, 30000);
	}
	if (da.type == Package.TYPE_KICK) {
		logger.info("被中央服务器踢下线了");
	}
});

socket.on('error', function (error) {
	logger.error("与中央服务器连接发生异常:" + JSON.stringify(error));
});

socket.on('close', function () {
	logger.error("与中央服务器连接被关闭");
});

socket.sendMsg = function (route, obj) {
	// logger.info("消息通知中央服务器:route:" + route + "\nparam:" + JSON.stringify(obj));
	var msg = Protocol.strencode(JSON.stringify(obj));
	msg = Message.encode(0, Message.TYPE_REQUEST, 0, route, msg);
	var packet = Package.encode(Package.TYPE_DATA, msg);
	socket.write(packet);
};

exports.socket = socket;
