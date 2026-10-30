import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';

dayjs.locale('zh-cn');

// 说明：不使用 React.StrictMode。StrictMode 在开发模式下会故意双次挂载副作用，
// 导致页面 useEffect 中的接口请求在浏览器 Network 中重复出现（生产构建不会）。
// 为便于演示/评审排查，这里关闭 StrictMode，保证开发与生产行为一致（DECISIONS D17）。
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
    }}
  >
    <AntdApp>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AntdApp>
  </ConfigProvider>,
);
