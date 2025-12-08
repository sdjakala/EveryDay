import callbackHandler from "../../../api/auth/callback.js";

export default function handler(req, res) {
  return callbackHandler(req, res);
}
