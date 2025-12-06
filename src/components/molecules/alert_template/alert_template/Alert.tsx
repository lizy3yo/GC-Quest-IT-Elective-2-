'use client';

import { useState, useEffect } from 'react';
import './Alert.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
    type: AlertType;
    message: string;
    title?: string;
    isVisible: boolean;
    onClose?: () => void;
    autoClose?: boolean;
    autoCloseDelay?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    showIcon?: boolean;
    className?: string;
}

const Alert: React.FC<AlertProps> = ({
    type,
    message,
    title,
    isVisible,
    onClose,
    autoClose = false,
    autoCloseDelay = 5000,
    position = 'top-right',
    showIcon = true,
    className = ''
}) => {
    const [visible, setVisible] = useState(isVisible);

    useEffect(() => {
        setVisible(isVisible);
    }, [isVisible]);

    useEffect(() => {
        if (visible && autoClose) {
            const timer = setTimeout(() => {
                handleClose();
            }, autoCloseDelay);

            return () => clearTimeout(timer);
        }
    }, [visible, autoClose, autoCloseDelay]);

    const handleClose = () => {
        setVisible(false);
        onClose?.();
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
                return 'ℹ';
            default:
                return '';
        }
    };

    if (!visible) return null;

    return (
        <div className={`alert alert-${type} alert-${position} ${className}`}>
            <div className="alert-content">
                {showIcon && (
                    <div className="alert-icon">
                        {getIcon()}
                    </div>
                )}
                <div className="alert-text">
                    {title && <div className="alert-title">{title}</div>}
                    <div className="alert-message">{message}</div>
                </div>
                {onClose && (
                    <button 
                        className="alert-close"
                        onClick={handleClose}
                        aria-label="Close alert"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

export default Alert;