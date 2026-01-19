import multer from 'multer'

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1, 
  },
  fileFilter(req, file, cb) {
      const allowedMimes = [
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      ]

      if (!allowedMimes.includes(file.mimetype)){
        return cb(new Error('invalid file type'))
      }

      return cb(null, true)
    }
})

export default uploadMiddleware