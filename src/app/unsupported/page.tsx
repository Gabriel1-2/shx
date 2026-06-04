import React from 'react';

export default function UnsupportedRegionPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md space-y-6">
                <div className="text-red-500 mb-4 flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                    Region Unsupported
                </h1>
                
                <p className="text-gray-400 text-lg leading-relaxed">
                    We're sorry, but Shulevitz Holdings Inc. and its trading services are currently unavailable in your region due to international regulatory compliance and sanctions.
                </p>

                <div className="pt-6 border-t border-gray-800">
                    <p className="text-sm text-gray-500">
                        If you believe this is an error and you are not attempting to access the platform from a restricted jurisdiction, please ensure you are not using a VPN routing through a restricted country.
                    </p>
                </div>

                <div className="mt-8">
                    <p className="text-xs text-gray-600 uppercase tracking-widest">
                        SHULEVITZ HOLDINGS INC.
                    </p>
                </div>
            </div>
        </div>
    );
}
