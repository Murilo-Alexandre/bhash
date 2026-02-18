const { io } = require('socket.io-client');

const token = process.env.TOKEN;
const conversationId = process.env.CONV;

if (!token || !conversationId) {
  console.log('Use: TOKEN=... CONV=... node tools/ws-test.js');
  process.exit(1);
}

const socket = io('http://localhost:3000', {
  auth: { token },
});

socket.on('connect', () => console.log('connected', socket.id));
socket.on('connected', (x) => console.log('connected event:', x));
socket.on('message:new', (msg) => console.log('message:new:', msg));

socket.emit('conversation:join', { conversationId }, (ack) => {
  console.log('join ack:', ack);

  socket.emit('message:send', { conversationId, body: 'Mensagem via WS 🚀' }, (ack2) => {
    console.log('send ack:', ack2);
  });
});
