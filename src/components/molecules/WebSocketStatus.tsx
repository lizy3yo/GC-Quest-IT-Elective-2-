'use client';

import React from 'react';
import { useWebSocketStatus } from '@/hooks/useWebSocket';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

interface WebSocketStatusProps {
  showText?: boolean;
  className?: string;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  showText = false,
  className = '' 
}) => {
  const { status, isConnected, connect } = useWebSocketStatus();

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          color: 'text-green-500',
          bgColor: 'bg-green-100',
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          text: 'Reconnecting...',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          animate: true,
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Connection Error',
          color: 'text-red-500',
          bgColor: 'bg-red-100',
        };
      default:
        return {
          icon: WifiOff,
          text: 'Disconnected',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (!showText) {
    return (
      <div className={`relative ${className}`} title={config.text}>
        <Icon 
          className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
        />
        {isConnected && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} ${className}`}
      onClick={status === 'error' ? connect : undefined}
      role={status === 'error' ? 'button' : undefined}
      style={{ cursor: status === 'error' ? 'pointer' : 'default' }}
    >
      <Icon 
        className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
      />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
      {status === 'error' && (
        <span className="text-xs text-gray-600">(Click to retry)</span>
      )}
    </div>
  );
};
