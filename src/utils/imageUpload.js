/**
 * Image Upload Utility
 * Handles image uploads and converts to base64 for storage
 */

/**
 * Convert file to base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} Base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Validate image file
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateImage = (file, options = {}) => {
  const {
    maxSizeMB = 5, // Default 5MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  } = options;

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Noto'g'ri fayl formati. Faqat ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} qabul qilinadi.`
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Fayl juda katta. Maksimal hajm: ${maxSizeMB}MB`
    };
  }

  return { valid: true, error: null };
};

/**
 * Compress image to reduce file size
 * @param {File} file - Image file
 * @param {Object} options - Compression options
 * @returns {Promise<string>} Compressed base64 string
 */
export const compressImage = (file, options = {}) => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', quality);
      resolve(base64);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Upload and process image
 * @param {File} file - Image file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} { success: boolean, data: string, error: string }
 */
export const uploadImage = async (file, options = {}) => {
  try {
    // Validate
    const validation = validateImage(file, options);
    if (!validation.valid) {
      return { success: false, data: null, error: validation.error };
    }

    // Compress and convert to base64
    const base64 = await compressImage(file, options);
    
    return { success: true, data: base64, error: null };
  } catch (error) {
    console.error('Image upload error:', error);
    return { 
      success: false, 
      data: null, 
      error: 'Rasm yuklashda xatolik yuz berdi' 
    };
  }
};

/**
 * Get file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human readable size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
