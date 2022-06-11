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

    it("an approver address should be able to create request withdraw", async() => {
        //try with account 5
        await expectRevert(
            multisig.connect(account5).requestWithdraw(10, account5.address),
            "VM Exception while processing transaction"
        )

        await multisig.connect(account1).requestWithdraw(10, account5.address);
        let result = await multisig.getWithdrawRequest(0);
        
        expect(result[0]).to.equal(10)
        expect(result[1]).to.equal(account5.address)
        expect(result[2]).to.equal(1)
        expect(result[3]).to.equal(false)
        expect(result[4]).to.equal(false)
    })

    it("an approver can vote on withdraw", async() => {
        await multisig.connect(account1).requestWithdraw(10, account5.address);

        let voteResult = await multisig.getCurrentVote(0, account1.address);
        let withdrawResult = await multisig.getWithdrawRequest(0);

        expect(voteResult == true)
        expect(withdrawResult[2] == 1)
        expect(withdrawResult[3] == false)
        expect(withdrawResult[4] == false)
    })

    it("withdraw request should know to set withdraw bool to true when enough votes equal percentage needed", async ()=> {
        await multisig.connect(account1).requestWithdraw(10, account5.address);
        await multisig.connect(account2).voteOnWithdraw(0, true);

        let withdrawResult = await multisig.getWithdrawRequest(0);

        expect(withdrawResult[4] == true)
    })

    it("SHOULDNT allow an address to vote more than once", async() => {
        await multisig.connect(account1).requestWithdraw(10, account5.address);
        await expectRevert(
            multisig.connect(account1).voteOnWithdraw(0, true),
            "this address has already voted"
        )

        let withdrawResult = await multisig.getWithdrawRequest(0);

        expect(withdrawResult[4] == false)
    })

    it("should be able to withdraw funds when enough approvers approve by approver", async () => {
        const provider = waffle.provider;

        await multisig.connect(account1).deposit({value: 100})
        await multisig.connect(account1).requestWithdraw(10, account5.address);
        await multisig.connect(account2).voteOnWithdraw(0, true);

        let balanceBefore = await provider.getBalance(account5.address);

        await multisig.connect(account1).withdraw(0);

        let balanceAfter = await provider.getBalance(account5.address);

        let result = await ethers.BigNumber.from(balanceAfter).sub(ethers.BigNumber.from(balanceBefore));

        expect(result).to.equal(10);

    })

    it("should be able to withdraw funds when enough approvers approve by receiver", async () => {
        const provider = waffle.provider;

        await multisig.connect(account1).deposit({value: 10})
        await multisig.connect(account1).requestWithdraw(10, account5.address);
        await multisig.connect(account2).voteOnWithdraw(0, true);

        let balanceBefore = await provider.getBalance(multisig.address);
        expect(balanceBefore).to.equal(10);

        await multisig.connect(account5).withdraw(0);

        let balanceAfter = await provider.getBalance(multisig.address);
        expect(balanceAfter).to.equal(0);
    })
})