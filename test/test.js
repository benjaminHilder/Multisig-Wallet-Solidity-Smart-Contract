const { expect } = require("chai");
const { ethers, waffle} = require("hardhat");
const { expectRevert} = require("@openzeppelin/test-helpers");
const testHelpers = require("@openzeppelin/test-helpers");

describe("multisig wallet", async() => {
    let multisig;
    
    let account1;
    let account2;
    let account3;
    let account4;
    let account5;

    beforeEach(async() => {
        [account1, account2, account3, account4, account5] = await ethers.getSigners();

        const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
        multisig = await MultisigWallet.deploy([account1.address, account2.address, account3.address, account4.address], 50)
        await multisig.deployed();
    })

    it("an approver address should be able to create request Transaction", async() => {
        //try with account 5
        await expectRevert(
            multisig.connect(account5).requestTransaction(10, account5.address, "test description"),
            "VM Exception while processing transaction"
        )

        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");
        let result = await multisig.getTransactionRequest(0);
        
        expect(result[0]).to.equal("test description")
        expect(result[1]).to.equal(10)
        expect(result[2]).to.equal(account5.address)
        expect(result[3]).to.equal(1)
        expect(result[4]).to.equal(false)
        expect(result[5]).to.equal(false)

        expect(multisig.getDescription(0) == "test description")
        expect(multisig.getHasVoted(0, account1.address) == true);
        expect(multisig.getCurrentVote(0, account1.address) == true)
        expect(multisig.getApprovalPercentageToPass() == 50)
    })


    it("an approver can vote on Transaction", async() => {
        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");

        let voteResult = await multisig.getCurrentVote(0, account1.address);
        let transactionResult = await multisig.getTransactionRequest(0);

        expect(voteResult == true)
        expect(transactionResult[2] == 1)
        expect(transactionResult[3] == false)
        expect(transactionResult[4] == false)
    })

    it("Transaction request should know to set transaction bool to true when enough votes equal percentage needed", async ()=> {
        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");
        await multisig.connect(account2).voteOnTransaction(0, true);

        let transactionResult = await multisig.getTransactionRequest(0);

        expect(transactionResult[4] == true)
    })

    it("SHOULDNT allow an address to vote more than once", async() => {
        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");
        await expectRevert(
            multisig.connect(account1).voteOnTransaction(0, true),
            "this address has already voted"
        )

        let transactionResult = await multisig.getTransactionRequest(0);

        expect(transactionResult[4] == false)
    })

    it("should be able to transaction funds when enough approvers approve by approver", async () => {
        const provider = waffle.provider;

        await multisig.connect(account1).deposit({value: 100})
        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");
        await multisig.connect(account2).voteOnTransaction(0, true);

        let balanceBefore = await provider.getBalance(account5.address);

        await multisig.connect(account1).withdraw(0);

        let balanceAfter = await provider.getBalance(account5.address);

        let result = await ethers.BigNumber.from(balanceAfter).sub(ethers.BigNumber.from(balanceBefore));

        expect(result).to.equal(10);

    })

    it("should be able to transaction funds when enough approvers approve by receiver", async () => {
        const provider = waffle.provider;

        await multisig.connect(account1).deposit({value: 10})
        await multisig.connect(account1).requestTransaction(10, account5.address, "test description");
        await multisig.connect(account2).voteOnTransaction(0, true);

        let balanceBefore = await provider.getBalance(multisig.address);
        expect(balanceBefore).to.equal(10);

        await multisig.connect(account5).withdraw(0);

        let balanceAfter = await provider.getBalance(multisig.address);
        expect(balanceAfter).to.equal(0);
    })
})