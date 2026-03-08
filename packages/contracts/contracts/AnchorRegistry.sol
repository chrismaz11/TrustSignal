// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract AnchorRegistry {
    event Anchored(bytes32 receiptHash, bytes32 subjectDigest, bytes32 anchorId, address sender, uint256 timestamp);

    mapping(bytes32 => bytes32) private receiptSubject;
    mapping(bytes32 => bool) private anchoredSubject;

    function anchor(bytes32 receiptHash) external returns (bytes32 anchorId) {
        return anchorWithSubject(receiptHash, receiptHash);
    }

    function anchorWithSubject(bytes32 receiptHash, bytes32 subjectDigest) public returns (bytes32 anchorId) {
        require(subjectDigest != bytes32(0), "Invalid subject");
        require(receiptSubject[receiptHash] == bytes32(0), "Receipt already anchored");
        require(!anchoredSubject[subjectDigest], "Subject already anchored");

        receiptSubject[receiptHash] = subjectDigest;
        anchoredSubject[subjectDigest] = true;
        anchorId = keccak256(abi.encodePacked(receiptHash, subjectDigest, msg.sender, block.number));
        emit Anchored(receiptHash, subjectDigest, anchorId, msg.sender, block.timestamp);
    }

    function isAnchored(bytes32 receiptHash) external view returns (bool) {
        return receiptSubject[receiptHash] != bytes32(0);
    }

    function isSubjectAnchored(bytes32 subjectDigest) external view returns (bool) {
        return anchoredSubject[subjectDigest];
    }

    function subjectForReceipt(bytes32 receiptHash) external view returns (bytes32) {
        return receiptSubject[receiptHash];
    }
}
