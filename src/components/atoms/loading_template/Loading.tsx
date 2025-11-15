'use client';

import { memo, useEffect, useState } from 'react';
import './Loading.css';

export type LoadingSize = 'small' | 'medium' | 'large';
export type LoadingType = 'spinner' | 'dots' | 'pulse' | 'bars';

interface LoadingProps {
    type?: LoadingType;
    size?: LoadingSize;
    overlay?: boolean;
    message?: string;
    className?: string;
}

const Loading: React.FC<LoadingProps> = memo(({
    type = 'spinner',
    size = 'medium',
    overlay = false,
    message,
    className = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Small delay to prevent flash for quick operations
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const renderSpinner = () => {
        switch (type) {
            case 'spinner':
                return <div className={`loading-spinner loading-${size}`} />;
            
            case 'dots':
                return (
                    <div className={`loading-dots loading-${size}`}>
                        <div />
                        <div />
                        <div />
                    </div>
                );
            
            case 'pulse':
                return <div className={`loading-pulse loading-${size}`} />;
            
            case 'bars':
                return (
                    <div className={`loading-bars loading-${size}`}>
                        <div />
                        <div />
                        <div />
                        <div />
                    </div>
                );
            
            default:
                return <div className={`loading-spinner loading-${size}`} />;
        }
    };

    const content = (
        <div className={`loading-content ${className}`}>
            {renderSpinner()}
            {message && <div className="loading-message">{message}</div>}
        </div>
    );

    if (overlay) {
        return (
            <div className={`loading-overlay ${!isVisible ? 'loading-hidden' : ''}`}>
                {content}
            </div>
        );
    }

    return content;
});

Loading.displayName = 'Loading';

export default Loading;
