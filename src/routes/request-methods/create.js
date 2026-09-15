module.exports = async function create(req, res, next) {
  try {
    const created = await req.service.create(req);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};
