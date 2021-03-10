/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: 'Genesis Block' });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, reject) => {
      resolve(this.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  async _addBlock(block) {
    // First of all, we make sure that the chain is valid
    const chainErrors = await this.validateChain();

    // If it's not, we throw an error
    if (chainErrors.length > 0) {
      throw new Error('The chain is invalid');
    }

    // increase the height
    this.height++;

    // block height
    block.height = this.height;
    // UTC timestamp
    block.time = new Date().getTime().toString().slice(0, -3);

    if (this.height > 0) {
      // previous block hash
      block.previousBlockHash = this.chain[this.height - 1].hash;
    }

    // SHA256 requires a string of data
    block.hash = SHA256(JSON.stringify(block)).toString();

    // add block to chain
    this.chain.push(block);
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  async requestMessageOwnershipVerification(address) {
    return `${address}:${new Date()
      .getTime()
      .toString()
      .slice(0, -3)}:starRegistry`;
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  async submitStar(address, message, signature, star) {
    // Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
    const messageTime = parseInt(message.split(':')[1]);
    // Get the current time
    const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

    // Check if the time elapsed is less than 5 minutes
    if (currentTime - messageTime > 300 /* 5 minutes in seconds */) {
      throw new Error('Message timed out');
    }

    // Verify the message with wallet address and signature
    if (!bitcoinMessage.verify(message, address, signature)) {
      throw new Error("Couldn't verify message");
    }

    // Create the block and add it to the chain
    const block = new BlockClass.Block({ owner: address, data: star });
    await this._addBlock(block);

    // Resolve with the block added
    return block;
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  async getBlockByHash(hash) {
    return this.chain.find((block) => block.hash === hash) || null;
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  async getBlockByHeight(height) {
    return this.chain.find((block) => block.height === height) || null;
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  async getStarsByWalletAddress(address) {
    const stars = [];

    for (let i = 1; i <= this.height; i++) {
      const blockData = await this.chain[i].getBData();

      if (blockData.owner === address) {
        stars.push(blockData);
      }
    }

    return stars;
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  async validateChain() {
    const errorLog = [];

    for (let i = 1; i <= this.height; i++) {
      if (!(await this.chain[i].validate())) {
        errorLog.push(
          new Error(`The block with hash ${this.chain[i].hash} is invalid`),
        );
      }

      if (this.chain[i].previousBlockHash !== this.chain[i - 1].hash) {
        errorLog.push(
          new Error(
            `The block with hash ${this.chain[i].hash} has an invalid previous block hash`,
          ),
        );
      }
    }

    return errorLog;
  }
}

module.exports.Blockchain = Blockchain;
