/* toll.js — TASK 8: the 5-USDC anti-spam gate, as a library.
   A stranger's introduction costs 5 USDC, held in escrow, refunded on reply.
   The gate emits the escrow event shape (ui/ scenario viewer schema) so the
   introduction is a first-class order the engine already understands.
   Refusals show their math (amber, never red — the design law). */
var TOLL=(function(){
  var FEE=5;
  function event(fromDID,toDID,roomUrl){
    return {
      order_id:'intro-'+Date.now().toString(36),
      buyer_did:fromDID||'did:plc:unbound',
      seller_did:toDID||'did:plc:unbound',
      amount:FEE*1000000,           // USDC 6dp
      asset_id:'usdc-asset-id',
      escrow_wallet_id:'intro-msig',
      payload_note:'introduction — refunded on reply',
      room:roomUrl||null,
      guards:[
        {k:'usdc_provided',v:0,req:FEE*1000000,met:false},
        {k:'relay_fee_zano',v:0,req:0,met:true}
      ]
    };
  }
  function render(el,ev){
    el.innerHTML='<div style="font-size:11px;line-height:2">'+
      'introduction fee: <b style="color:#9FFF3D">'+FEE+' USDC</b> — held in escrow, refunded when they reply<br>'+
      ev.guards.map(function(g){
        var ok=g.v>=g.req;
        return '<span style="color:#e8b84a">'+g.k+': '+g.v+' / '+g.req+' '+(ok?'\u2713':'\u2717 short')+'</span>';
      }).join('<br>')+
      '<br><span style="color:#5a6478">the gate opens when the escrow rail docks — the event is ready below</span></div>'+
      '<pre style="font-size:9px;color:#5a6478;white-space:pre-wrap;word-break:break-all">'+JSON.stringify(ev,null,1)+'</pre>';
  }
  return {fee:FEE,event:event,render:render};
})();
