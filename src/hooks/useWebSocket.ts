/**
 * WebSocket Hook - 真正解决重连与刷屏的单例版
 */
import { useEffect, useState, useRef } from 'react';

export interface WSMessage {
    type: string;
    data: any;
}

// 模块级变量，跨组件共享
let wsInstance: WebSocket | null = null;
let isWsConnected = false;
let connectingPromise: Promise<WebSocket> | null = null;
const messageListeners = new Set<(msg: WSMessage) => void>();
const statusListeners = new Set<(connected: boolean) => void>();

function connect(url: string): Promise<WebSocket> {
    if (wsInstance?.readyState === WebSocket.OPEN) return Promise.resolve(wsInstance);
    if (connectingPromise) return connectingPromise;

    connectingPromise = new Promise((resolve, reject) => {
        console.log('🔌 [WS] 正在尝试建立全局连接:', url);
        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('✅ [WS] 全局连接建立成功');
            wsInstance = ws;
            isWsConnected = true;
            connectingPromise = null;
            statusListeners.forEach(fn => fn(true));
            resolve(ws);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                messageListeners.forEach(fn => fn(data));
            } catch (e) { }
        };

        ws.onclose = () => {
            console.log('❌ [WS] 全局连接已关闭');
            wsInstance = null;
            isWsConnected = false;
            connectingPromise = null;
            statusListeners.forEach(fn => fn(false));
            // 延迟重连
            setTimeout(() => connect(url), 3000);
        };

        ws.onerror = (err) => {
            ws.close();
            reject(err);
        };
    });

    return connectingPromise;
}

export function useWebSocket(url: string, onMessage?: (msg: WSMessage) => void) {
    const [isConnected, setIsConnected] = useState(isWsConnected);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        // 监听状态变化
        const handleStatus = (status: boolean) => setIsConnected(status);
        statusListeners.add(handleStatus);

        // 监听消息
        const handleMsg = (msg: WSMessage) => onMessageRef.current?.(msg);
        messageListeners.add(handleMsg);

        // 确保连接
        connect(url);

        return () => {
            statusListeners.delete(handleStatus);
            messageListeners.delete(handleMsg);
        };
    }, [url]);

    return { isConnected };
}
