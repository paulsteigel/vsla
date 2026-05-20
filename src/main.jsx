import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#E4701E',
          colorLink: '#435CE1',
          borderRadius: 8,
          fontFamily: 'Poppins, sans-serif',
        },
        components: {
          DatePicker: { colorPrimary: '#E4701E' },
          Select: { colorPrimary: '#E4701E' },
          Table: { headerBg: '#E4701E', headerColor: '#ffffff' },
        },
      }}
    >
      <App />
      <ToastContainer position="top-center" autoClose={2000} hideProgressBar theme="colored" />
    </ConfigProvider>
  </BrowserRouter>
)
