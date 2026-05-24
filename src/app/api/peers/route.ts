import { NextResponse } from 'next/server';
import { MdnsService } from '@/services/mdnsService';

export async function GET() {
  const mdns = MdnsService.getInstance();
  const peers = mdns.getPeers();
  
  return NextResponse.json({
    peers,
    selfId: mdns.getSelfId(),
    localIp: mdns.getLocalIp()
  });
}
