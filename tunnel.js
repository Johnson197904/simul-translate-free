const localtunnel = require('localtunnel');

const SUBDOMAIN = 'peeklytrans';
const TUNNEL_PORT = 8765;

async function startTunnel() {
  console.log('正在连接 localtunnel...');

  const tunnel = await localtunnel({
    port: TUNNEL_PORT,
    subdomain: SUBDOMAIN,
    allow_invalid_cert: true
  });

  console.log('================================');
  console.log('外网访问地址:');
  console.log(tunnel.url);
  console.log('================================');
  console.log('保持此窗口开着！');
  console.log('');
  console.log('注意：首次访问需要输入密码');
  console.log('请访问 https://' + tunnel.url.replace('https://', '') + ' 并输入密码');
  console.log('隧道端口: ' + TUNNEL_PORT);

  tunnel.on('close', () => {
    console.log('隧道断开，5秒后重连...');
    setTimeout(startTunnel, 5000);
  });

  tunnel.on('error', (err) => {
    console.log('隧道错误:', err.message);
  });
}

startTunnel().catch(err => {
  console.error('启动失败:', err.message);
  console.log('5秒后重试...');
  setTimeout(startTunnel, 5000);
});