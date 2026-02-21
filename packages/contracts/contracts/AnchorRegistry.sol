// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AnchorRegistry
 * @dev A registry for storing cryptographic anchors (hashes) of receipts.
 * It features an embedded 3-of-5 multisig for sensitive operations like
 * pausing the contract in case of an emergency.
 * It strictly avoids custody, tokens, or PII.
 */
contract AnchorRegistry is Pausable {
    event Anchored(bytes32 receiptHash, bytes32 anchorId, address sender, uint256 timestamp);
    
    // Multisig Events
    event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, ActionType action);
    event ProposalApproved(uint256 indexed proposalId, address indexed approver);
    event ProposalExecuted(uint256 indexed proposalId);
    event OwnerReplaced(address indexed oldOwner, address indexed newOwner);

    enum ActionType { Pause, Unpause, ReplaceOwner }

    struct Proposal {
        ActionType action;
        address oldOwner;
        address newOwner;
        bool executed;
        uint256 approvalCount;
        mapping(address => bool) approvals;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public constant THRESHOLD = 3;

    mapping(bytes32 => bool) private anchored;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    constructor(address[] memory _owners) {
        require(_owners.length == 5, "Must have exactly 5 owners");
        for (uint256 i = 0; i < 5; i++) {
            require(_owners[i] != address(0), "Invalid owner");
            require(!isOwner[_owners[i]], "Duplicate owner");
            isOwner[_owners[i]] = true;
            owners.push(_owners[i]);
        }
    }

    /**
     * @dev Anchors a receipt hash. Cannot be called when the contract is paused.
     */
    function anchor(bytes32 receiptHash) external whenNotPaused returns (bytes32 anchorId) {
        require(!anchored[receiptHash], "Already anchored");
        anchored[receiptHash] = true;
        anchorId = keccak256(abi.encodePacked(receiptHash, msg.sender, block.number));
        emit Anchored(receiptHash, anchorId, msg.sender, block.timestamp);
    }

    function isAnchored(bytes32 receiptHash) external view returns (bool) {
        return anchored[receiptHash];
    }

    /**
     * @dev Submits a proposal for a sensitive action.
     */
    function submitProposal(ActionType _action, address _oldOwner, address _newOwner) external onlyOwner returns (uint256 id) {
        if (_action == ActionType.ReplaceOwner) {
            require(isOwner[_oldOwner], "Old owner not found");
            require(_newOwner != address(0), "Invalid new owner");
            require(!isOwner[_newOwner], "Already an owner");
        }

        id = proposalCount++;
        Proposal storage p = proposals[id];
        p.action = _action;
        p.oldOwner = _oldOwner;
        p.newOwner = _newOwner;
        p.executed = false;
        
        emit ProposalSubmitted(id, msg.sender, _action);
        
        // Auto-approve by the submitter
        approveProposal(id);
    }

    /**
     * @dev Approves a pending proposal.
     */
    function approveProposal(uint256 _proposalId) public onlyOwner {
        require(_proposalId < proposalCount, "Invalid proposal");
        Proposal storage p = proposals[_proposalId];
        require(!p.executed, "Already executed");
        require(!p.approvals[msg.sender], "Already approved");

        p.approvals[msg.sender] = true;
        p.approvalCount += 1;

        emit ProposalApproved(_proposalId, msg.sender);

        if (p.approvalCount >= THRESHOLD) {
            executeProposal(_proposalId);
        }
    }

    /**
     * @dev Internal function to execute the proposal once threshold is met.
     */
    function executeProposal(uint256 _proposalId) internal {
        Proposal storage p = proposals[_proposalId];
        require(p.approvalCount >= THRESHOLD, "Threshold not met");
        require(!p.executed, "Already executed");

        p.executed = true;

        if (p.action == ActionType.Pause) {
            _pause();
        } else if (p.action == ActionType.Unpause) {
            _unpause();
        } else if (p.action == ActionType.ReplaceOwner) {
            isOwner[p.oldOwner] = false;
            isOwner[p.newOwner] = true;
            for (uint256 i = 0; i < owners.length; i++) {
                if (owners[i] == p.oldOwner) {
                    owners[i] = p.newOwner;
                    break;
                }
            }
            emit OwnerReplaced(p.oldOwner, p.newOwner);
        }

        emit ProposalExecuted(_proposalId);
    }
}
