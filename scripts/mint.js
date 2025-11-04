// The path is now corrected to properly locate the .env file from the scripts directory
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { ethers } = require('ethers');
const contractABI = require('../contracts/ReliefCoin.json').abi;

const mintTokens = async () => {
  // Get the arguments from the command line
  const beneficiaryAddress = process.argv[2];
  const amount = process.argv[3];

  if (!beneficiaryAddress || !amount) {
    console.error("Please provide a beneficiary address and an amount.");
    process.exit(1);
  }

  if (!process.env.OWNER_PRIVATE_KEY) {
    console.error("OWNER_PRIVATE_KEY not found in .env file.");
    process.exit(1);
  }

  // Connect to the blockchain
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');
  const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
  const reliefCoinContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, signer);

  try {
    console.log(`Minting ${amount} RC to ${beneficiaryAddress}...`);
    const amountToMint = ethers.parseUnits(amount.toString(), 18);
    const tx = await reliefCoinContract.mint(beneficiaryAddress, amountToMint);
    await tx.wait();
    console.log(`Minting successful! Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error("Minting failed:", error.message);
  }
};

mintTokens();