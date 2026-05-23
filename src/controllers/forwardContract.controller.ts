import { Request, Response } from 'express';
import ForwardContract from '../models/forwardContract.model';

// @desc    Get all forward contracts
// @route   GET /api/forward-contracts
// @access  Public
export const getAllForwardContracts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const contracts = await ForwardContract.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching forward contracts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get single forward contract by ID or reference number
// @route   GET /api/forward-contracts/:id
// @access  Public
export const getForwardContractById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let contract;

    // Check if id is a MongoDB ObjectId (24 hex characters) or a reference number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isObjectId) {
      contract = await ForwardContract.findById(id);
    } else {
      // Assume it's a reference number
      contract = await ForwardContract.findOne({ referenceNumber: id });
    }

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'Forward contract not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get forward contract by reference number
// @route   GET /api/forward-contracts/reference/:refNumber
// @access  Public
export const getForwardContractByReference = async (req: Request, res: Response): Promise<void> => {
  try {
    const contract = await ForwardContract.findOne({ referenceNumber: req.params.refNumber });

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'Forward contract not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get forward contracts by customer ID
// @route   GET /api/forward-contracts/customer/:customerId
// @access  Public
export const getForwardContractsByCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const contracts = await ForwardContract.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching forward contracts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Create new forward contract
// @route   POST /api/forward-contracts
// @access  Public
export const createForwardContract = async (req: Request, res: Response): Promise<void> => {
  try {
    // Debug: Log received data
    console.log('Received data:', JSON.stringify(req.body, null, 2));

    const {
      bookingDate,
      customerName,
      customerId,
      address1,
      address2,
      address3,
      country,
      entity,
      bank,
      typeOfBooking,
      typeOfDelivery,
      typeOfPurchase,
      purpose,
      baseCurrency,
      quoteCurrency,
      amountInBase,
      amountInQuote,
      currentRate,
      forwardRate,
      premiumDiscount,
      status,
    } = req.body;

    // Helper function to convert empty strings to undefined
    const emptyToUndefined = (value: string | undefined) => 
      value === '' || value === null ? undefined : value;

    const contract = await ForwardContract.create({
      bookingDate: bookingDate || new Date(),
      customerName: emptyToUndefined(customerName),
      customerId: emptyToUndefined(customerId),
      address1: emptyToUndefined(address1),
      address2: emptyToUndefined(address2),
      address3: emptyToUndefined(address3),
      country: emptyToUndefined(country),
      entity: emptyToUndefined(entity),
      bank: emptyToUndefined(bank),
      typeOfBooking: emptyToUndefined(typeOfBooking),
      typeOfDelivery: emptyToUndefined(typeOfDelivery),
      typeOfPurchase: emptyToUndefined(typeOfPurchase),
      purpose: emptyToUndefined(purpose),
      baseCurrency: emptyToUndefined(baseCurrency),
      quoteCurrency: emptyToUndefined(quoteCurrency),
      amountInBase,
      amountInQuote,
      currentRate,
      forwardRate,
      premiumDiscount,
      status: emptyToUndefined(status),
    });

    res.status(201).json({
      success: true,
      message: 'Forward contract created successfully',
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Update forward contract (by ID or reference number)
// @route   PUT /api/forward-contracts/:id
// @access  Public
export const updateForwardContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Helper function to convert empty strings to undefined
    const emptyToUndefined = (value: string | undefined) => 
      value === '' || value === null ? undefined : value;

    const data = req.body;
    const cleanData = {
      bookingDate: data.bookingDate || undefined,
      customerName: emptyToUndefined(data.customerName),
      customerId: emptyToUndefined(data.customerId),
      address1: emptyToUndefined(data.address1),
      address2: emptyToUndefined(data.address2),
      address3: emptyToUndefined(data.address3),
      country: emptyToUndefined(data.country),
      entity: emptyToUndefined(data.entity),
      bank: emptyToUndefined(data.bank),
      typeOfBooking: emptyToUndefined(data.typeOfBooking),
      typeOfDelivery: emptyToUndefined(data.typeOfDelivery),
      typeOfPurchase: emptyToUndefined(data.typeOfPurchase),
      purpose: emptyToUndefined(data.purpose),
      baseCurrency: emptyToUndefined(data.baseCurrency),
      quoteCurrency: emptyToUndefined(data.quoteCurrency),
      amountInBase: data.amountInBase,
      amountInQuote: data.amountInQuote,
      currentRate: data.currentRate,
      forwardRate: data.forwardRate,
      premiumDiscount: data.premiumDiscount,
      status: emptyToUndefined(data.status),
    };

    // Remove undefined values
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key as keyof typeof cleanData] === undefined) {
        delete cleanData[key as keyof typeof cleanData];
      }
    });

    let contract;

    // Check if id is a MongoDB ObjectId (24 hex characters) or a reference number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isObjectId) {
      contract = await ForwardContract.findByIdAndUpdate(
        id,
        cleanData,
        { new: true, runValidators: true }
      );
    } else {
      // Assume it's a reference number
      contract = await ForwardContract.findOneAndUpdate(
        { referenceNumber: id },
        cleanData,
        { new: true, runValidators: true }
      );
    }

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'Forward contract not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Forward contract updated successfully',
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Delete forward contract (by ID or reference number)
// @route   DELETE /api/forward-contracts/:id
// @access  Public
export const deleteForwardContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let contract;

    // Check if id is a MongoDB ObjectId (24 hex characters) or a reference number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isObjectId) {
      contract = await ForwardContract.findByIdAndDelete(id);
    } else {
      // Assume it's a reference number
      contract = await ForwardContract.findOneAndDelete({ referenceNumber: id });
    }

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'Forward contract not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Forward contract deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Save forward contract (update existing or create new with 'pending' status)
// @route   POST /api/forward-contracts/save
// @access  Public
export const saveForwardContract = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Save - Received data:', JSON.stringify(req.body, null, 2));

    const { _id, ...data } = req.body;

    // Helper function to convert empty strings to undefined
    const emptyToUndefined = (value: string | undefined) => 
      value === '' || value === null ? undefined : value;

    const cleanData = {
      bookingDate: data.bookingDate || new Date(),
      customerName: emptyToUndefined(data.customerName),
      customerId: emptyToUndefined(data.customerId),
      address1: emptyToUndefined(data.address1),
      address2: emptyToUndefined(data.address2),
      address3: emptyToUndefined(data.address3),
      country: emptyToUndefined(data.country),
      entity: emptyToUndefined(data.entity),
      bank: emptyToUndefined(data.bank),
      typeOfBooking: emptyToUndefined(data.typeOfBooking),
      typeOfDelivery: emptyToUndefined(data.typeOfDelivery),
      typeOfPurchase: emptyToUndefined(data.typeOfPurchase),
      purpose: emptyToUndefined(data.purpose),
      baseCurrency: emptyToUndefined(data.baseCurrency),
      quoteCurrency: emptyToUndefined(data.quoteCurrency),
      amountInBase: data.amountInBase,
      amountInQuote: data.amountInQuote,
      currentRate: data.currentRate,
      forwardRate: data.forwardRate,
      premiumDiscount: data.premiumDiscount,
      status: 'pending', // Save always sets status to pending
    };

    let contract;

    if (_id) {
      // Update existing contract
      contract = await ForwardContract.findByIdAndUpdate(
        _id,
        cleanData,
        { new: true, runValidators: true }
      );

      if (!contract) {
        res.status(404).json({
          success: false,
          message: 'Forward contract not found',
        });
        return;
      }
    } else {
      // Create new contract
      contract = await ForwardContract.create(cleanData);
    }

    res.status(_id ? 200 : 201).json({
      success: true,
      message: _id ? 'Forward contract saved successfully' : 'Forward contract created successfully',
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving forward contract',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Save forward contract as draft
// @route   POST /api/forward-contracts/draft
// @access  Public
export const saveForwardContractAsDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Draft - Received data:', JSON.stringify(req.body, null, 2));

    const { _id, ...data } = req.body;

    // Helper function to convert empty strings to undefined
    const emptyToUndefined = (value: string | undefined) => 
      value === '' || value === null ? undefined : value;

    const cleanData = {
      bookingDate: data.bookingDate || new Date(),
      customerName: emptyToUndefined(data.customerName),
      customerId: emptyToUndefined(data.customerId),
      address1: emptyToUndefined(data.address1),
      address2: emptyToUndefined(data.address2),
      address3: emptyToUndefined(data.address3),
      country: emptyToUndefined(data.country),
      entity: emptyToUndefined(data.entity),
      bank: emptyToUndefined(data.bank),
      typeOfBooking: emptyToUndefined(data.typeOfBooking),
      typeOfDelivery: emptyToUndefined(data.typeOfDelivery),
      typeOfPurchase: emptyToUndefined(data.typeOfPurchase),
      purpose: emptyToUndefined(data.purpose),
      baseCurrency: emptyToUndefined(data.baseCurrency),
      quoteCurrency: emptyToUndefined(data.quoteCurrency),
      amountInBase: data.amountInBase,
      amountInQuote: data.amountInQuote,
      currentRate: data.currentRate,
      forwardRate: data.forwardRate,
      premiumDiscount: data.premiumDiscount,
      status: 'draft', // Draft always sets status to draft
    };

    let contract;

    if (_id) {
      // Update existing draft
      contract = await ForwardContract.findByIdAndUpdate(
        _id,
        cleanData,
        { new: true, runValidators: true }
      );

      if (!contract) {
        res.status(404).json({
          success: false,
          message: 'Forward contract not found',
        });
        return;
      }
    } else {
      // Create new draft
      contract = await ForwardContract.create(cleanData);
    }

    res.status(_id ? 200 : 201).json({
      success: true,
      message: _id ? 'Draft updated successfully' : 'Draft saved successfully',
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving draft',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Update forward contract status
// @route   PATCH /api/forward-contracts/:id/status
// @access  Public
export const updateForwardContractStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    if (!['active', 'completed', 'confirm', 'incomplete', 'pending', 'draft'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
      return;
    }

    const contract = await ForwardContract.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'Forward contract not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Forward contract status updated successfully',
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating forward contract status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
