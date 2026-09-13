const fs = require('fs');

/**
 * Known file signatures (magic bytes)
 */
const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4E, 0x47], // .PNG
  jpeg: [0xFF, 0xD8, 0xFF]       // JPEG
};

/**
 * Checks if buffer matches signature
 */
function matchesSignature(buffer, signature) {
  if (!buffer || buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Inspect file header on disk and verify against allowed signatures
 */
function validateFileMagicBytes(filePath, allowedTypes = ['pdf', 'png', 'jpeg']) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'FILE_NOT_FOUND' };
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  for (const type of allowedTypes) {
    if (SIGNATURES[type] && matchesSignature(buffer, SIGNATURES[type])) {
      return { valid: true, detectedType: type };
    }
  }

  return {
    valid: false,
    error: 'INVALID_FILE_SIGNATURE',
    message: 'File content does not match allowed binary signatures (PDF or Image expected). Malicious file upload blocked.'
  };
}

/**
 * Express middleware that checks uploaded files in req.files or req.file
 */
function enforceMagicByteValidation(allowedTypes = ['pdf', 'png', 'jpeg']) {
  return (req, res, next) => {
    const filesToValidate = [];

    if (req.file) {
      filesToValidate.push(req.file);
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        filesToValidate.push(...req.files);
      } else {
        Object.values(req.files).forEach(group => {
          if (Array.isArray(group)) filesToValidate.push(...group);
          else if (group) filesToValidate.push(group);
        });
      }
    }

    for (const file of filesToValidate) {
      if (!file.path) continue;
      const result = validateFileMagicBytes(file.path, allowedTypes);

      if (!result.valid) {
        // Immediately securely unlink the suspicious file
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (e) {
          console.error('[FileValidator] Error unlinking malicious file:', e.message);
        }

        return res.status(400).json({
          error: 'FILE_SECURITY_REJECTED',
          message: `Upload rejected: File "${file.originalname}" failed cryptographic binary signature check. The file content is not a legitimate ${allowedTypes.join(' or ')}.`,
          details: result.error
        });
      }
    }

    next();
  };
}

const validateUploadedFiles = enforceMagicByteValidation(['pdf', 'png', 'jpeg']);

module.exports = {
  validateFileMagicBytes,
  enforceMagicByteValidation,
  validateUploadedFiles
};
