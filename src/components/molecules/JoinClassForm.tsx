import { useState } from 'react';
import { useJoinClass } from '@/hooks/useJoinClass';

interface JoinClassFormProps {
  onClose: () => void;
}

export default function JoinClassForm({ onClose }: JoinClassFormProps) {
  const [joinCode, setJoinCode] = useState('');
  const { mutate: joinClass, isPending: isJoining, error } = useJoinClass();

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    joinClass(joinCode.trim(), {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Join a Class</h3>
      <div className="flex gap-3">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Enter class code (e.g., ABC123)"
          className="flex-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isJoining}
        />
        <button
          onClick={handleJoin}
          disabled={!joinCode.trim() || isJoining}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining ? 'Joining...' : 'Join'}
        </button>
        <button
          onClick={onClose}
          className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-all duration-200 text-sm"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error.message}</p>}
    </div>
  );
}
