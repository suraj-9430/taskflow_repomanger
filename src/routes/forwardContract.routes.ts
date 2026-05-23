import { Router } from 'express';
import {
  getAllForwardContracts,
  getForwardContractById,
  getForwardContractByReference,
  getForwardContractsByCustomer,
  createForwardContract,
  updateForwardContract,
  deleteForwardContract,
  updateForwardContractStatus,
  saveForwardContract,
  saveForwardContractAsDraft,
} from '../controllers/forwardContract.controller';

const router = Router();

// GET /api/forward-contracts - Get all forward contracts
router.get('/', getAllForwardContracts);

// GET /api/forward-contracts/reference/:refNumber - Get by reference number
router.get('/reference/:refNumber', getForwardContractByReference);

// GET /api/forward-contracts/customer/:customerId - Get by customer ID
router.get('/customer/:customerId', getForwardContractsByCustomer);

// GET /api/forward-contracts/:id - Get forward contract by ID
router.get('/:id', getForwardContractById);

// POST /api/forward-contracts - Create new forward contract (Submit)
router.post('/', createForwardContract);

// POST /api/forward-contracts/save - Save forward contract
router.post('/save', saveForwardContract);

// POST /api/forward-contracts/draft - Save as draft
router.post('/draft', saveForwardContractAsDraft);

// PUT /api/forward-contracts/:id - Update forward contract
router.put('/:id', updateForwardContract);

// PATCH /api/forward-contracts/:id/status - Update status only
router.patch('/:id/status', updateForwardContractStatus);

// DELETE /api/forward-contracts/:id - Delete forward contract
router.delete('/:id', deleteForwardContract);

export default router;
