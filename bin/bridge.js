#!/usr/bin/env node

var WebPeer = require('../lib/webPeer.js');
var PeerGroup = require('../lib/peerGroup.js');

/*var downloadPeer = null;

function startDownload(peer) {
  downloadPeer = peer;

  peer.on('headers', function(res) {
    console.dir(res.headers[0])
  })

  var message = new messages.GetHeaders({
    starts: [ '00000000dfd5d65c9d8561b4b8f60a63018fe3933ecb131fb37f905f87da951a' ]
  });

  console.log(message)
  peer.sendMessage(message);
}*/

var pg = new PeerGroup({ acceptWeb: true, verbose: true });
pg.on('peerconnect', function(peer) {
  var uri = peer.host+':'+peer.port;
  if(peer instanceof WebPeer) uri = '(WebRTC)';

  console.log('Connected to peer:', uri, peer.subversion);

  peer.on('disconnect', function() {
    console.log('Disconnected from peer:', uri, peer.subversion);
  });
})
pg.connect();
