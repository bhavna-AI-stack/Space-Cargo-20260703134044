import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';

interface EditPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
}

export default function EditPilotModal({ isOpen, onClose, currentName }: EditPilotModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateUsername = useStore(state => state.updateUsername);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentName || '');
      setErrorMsg('');
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setErrorMsg('Name must be between 3 and 20 characters.');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg('');
    const res = await updateUsername(trimmed);
    setIsSubmitting(false);
    
    if (res && !res.success) {
      setErrorMsg(res.message || 'Failed to change name');
    } else {
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-backdrop">
      <div className="crt-panel edit-pilot-modal" style={{ width: '400px', maxWidth: '90%', padding: '30px', boxSizing: 'border-box', overflow: 'hidden' }}>
        <h2 className="title" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>UPDATE PILOT CALLSIGN</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          <input 
            type="text" 
            className="console-input pilot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="ENTER CALLSIGN"
            maxLength={20}
            autoFocus
          />
          
          {errorMsg && <div style={{ color: '#ff005a', fontSize: '0.8rem', fontFamily: 'Courier New' }}>[ERROR]: {errorMsg}</div>}
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' }}>
            <button type="button" className="physical-btn" style={{ minWidth: '120px', padding: '10px', fontSize: '1rem' }} onClick={onClose} disabled={isSubmitting}>[ CANCEL ]</button>
            <button type="submit" className="physical-btn primary" style={{ minWidth: '120px', padding: '10px', fontSize: '1rem' }} disabled={isSubmitting}>[ CONFIRM ]</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
