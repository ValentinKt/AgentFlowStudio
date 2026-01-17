import React, { useRef } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  selectedImage: File | null;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, selectedImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
  };

  const removeImage = () => {
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {!selectedImage ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-all"
        >
          <ImageIcon size={14} />
          Add Image Context
        </button>
      ) : (
        <div className="flex items-center gap-2 px-2 py-1 bg-teal-50 text-teal-700 rounded-xl border border-teal-100 text-xs font-medium animate-in fade-in slide-in-from-left-2">
          <div className="w-6 h-6 rounded bg-teal-200 overflow-hidden">
            <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <span className="max-w-[100px] truncate">{selectedImage.name}</span>
          <button onClick={removeImage} className="p-1 hover:bg-teal-100 rounded-full transition-colors">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
