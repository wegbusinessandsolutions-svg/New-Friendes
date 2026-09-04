const fs = require('fs');

const originalRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    
    function isSignedIn() { return request.auth != null; }
    
    function isPrivilegedEmail() {
      return isSignedIn() && (
        request.auth.token.email == 'ceo@newfriends.com' || 
        request.auth.token.email == 'sac@wegbusiness.com' || 
        request.auth.token.email == 'ceo@wegbusiness.com' || 
        request.auth.token.email == 'wegbusinessandsolutions@gmail.com'
      );
    }
    
    function isAdmin() { 
      return isSignedIn() && (
        isPrivilegedEmail() ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin')
      );
    }
    
    function isCEO() { 
      return isSignedIn() && (
        request.auth.token.email == 'ceo@newfriends.com' || 
        request.auth.token.email == 'ceo@wegbusiness.com' || 
        request.auth.token.email == 'wegbusinessandsolutions@gmail.com'
      );
    }
    
    function isValidId(id) { return id.size() > 0 && id.size() <= 128; }
    function incoming() { return request.resource.data; }
    function existing() { return resource.data; }
    
    function isUserPublicValid(data) {
      return data.keys().hasAny(['profile', 'status', 'settings']);
    }
    
    function isRbacUnchanged() {
      return (!('role' in incoming()) || ('role' in existing() && incoming().role == existing().role)) &&
             (!('verified' in incoming()) || ('verified' in existing() && incoming().verified == existing().verified));
    }
    
    match /users/{userId} {
      allow read: if true;
      allow create: if isSignedIn() && request.auth.uid == userId && (
        (isUserPublicValid(incoming()) && !('role' in incoming()) && !('verified' in incoming())) ||
        isPrivilegedEmail()
      );
      allow update: if (isSignedIn() && request.auth.uid == userId && isUserPublicValid(incoming()) && isRbacUnchanged()) || 
                     isCEO() || 
                     isAdmin() || 
                     isPrivilegedEmail();
      allow delete: if isCEO() || isAdmin() || isPrivilegedEmail();
    }
    
    match /locations/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if isPrivilegedEmail();
      
      match /history/{historyDocId} {
        allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin() || isCEO() || isPrivilegedEmail());
        allow create: if isSignedIn() && request.auth.uid == userId;
        allow update: if false;
        allow delete: if isPrivilegedEmail();
      }
    }
    
    function isInteractionValid(data) {
      return data.keys().hasAll(['deUserId', 'paraUserId', 'tipo', 'status', 'createdAt', 'updatedAt']) &&
             data.deUserId is string && isValidId(data.deUserId) &&
             data.paraUserId is string && isValidId(data.paraUserId) &&
             data.tipo is string && (data.tipo == 'like' || data.tipo == 'superlike' || data.tipo == 'pass') &&
             data.status is string && (data.status == 'pending' || data.status == 'matched' || data.status == 'rejected');
    }
    
    match /interactions/{interactionId} {
      allow get: if isSignedIn() && (resource == null || resource.data.deUserId == request.auth.uid || resource.data.paraUserId == request.auth.uid);
      allow list: if isSignedIn() && (resource.data.deUserId == request.auth.uid || resource.data.paraUserId == request.auth.uid);
      allow create: if isSignedIn() && incoming().deUserId == request.auth.uid && isInteractionValid(incoming());
      allow update: if isSignedIn() && (existing().deUserId == request.auth.uid || existing().paraUserId == request.auth.uid) && isInteractionValid(incoming());
      allow delete: if isPrivilegedEmail();
    }
    
    function isConnectionValid(data) {
      return data.keys().hasAll(['users', 'status', 'createdAt', 'updatedAt']) &&
             data.users is list && data.users.size() == 2 &&
             data.users[0] is string && data.users[1] is string &&
             data.status is string && (data.status == 'pending' || data.status == 'accepted' || data.status == 'rejected');
    }
    
    match /connections/{connectionId} {
      allow get: if isSignedIn();
      allow list: if isSignedIn() && (request.auth.uid in resource.data.users || isAdmin() || isCEO());
      allow create: if isSignedIn() && request.auth.uid in incoming().users && isConnectionValid(incoming());
      allow update: if isSignedIn() && request.auth.uid in existing().users &&
                    (!('users' in incoming()) || incoming().users == existing().users);
      allow delete: if (isSignedIn() && request.auth.uid in existing().users) || isPrivilegedEmail();
    }
    
    function isShortMessageValid(data) {
      return data.keys().hasAll(['fromUserId', 'toUserId', 'message', 'createdAt']) &&
             data.fromUserId is string && isValidId(data.fromUserId) &&
             data.toUserId is string && isValidId(data.toUserId) &&
             data.message is string && data.message.size() > 0 && data.message.size() <= 1000;
    }
    
    match /shortMessages/{messageId} {
      allow get: if isSignedIn() && (resource == null || resource.data.fromUserId == request.auth.uid || resource.data.toUserId == request.auth.uid || isAdmin() || isCEO());
      allow list: if isSignedIn() && (resource.data.fromUserId == request.auth.uid || resource.data.toUserId == request.auth.uid || isAdmin() || isCEO());
      allow create: if isSignedIn() && incoming().fromUserId == request.auth.uid && isShortMessageValid(incoming());
      allow update: if false;
      allow delete: if isPrivilegedEmail();
    }
    
    function isFriendshipValid(data) {
      return data.keys().hasAll(['participantes', 'criadoEm', 'chatId']) &&
             data.participantes is list && data.participantes.size() == 2 &&
             data.participantes[0] is string && data.participantes[1] is string &&
             data.criadoEm is number &&
             data.chatId is string;
    }
    
    match /friendships/{friendshipId} {
      allow get: if isSignedIn() && (resource == null || request.auth.uid in existing().participantes);
      allow list: if isSignedIn() && (request.auth.uid in resource.data.participantes);
      allow create: if isSignedIn() && request.auth.uid in incoming().participantes && isFriendshipValid(incoming());
      allow update: if false;
      allow delete: if (isSignedIn() && request.auth.uid in existing().participantes) || isPrivilegedEmail();
    }
    
    match /chats/{chatId} {
      allow get: if isSignedIn();
      allow list: if isSignedIn() && (request.auth.uid in resource.data.participantes || isPrivilegedEmail());
      allow create: if isSignedIn() && (request.auth.uid in incoming().participantes);
      allow update: if isSignedIn() && (request.auth.uid in existing().participantes);
      allow delete: if isPrivilegedEmail();
      
      match /messages/{messageId} {
        allow read, list: if isSignedIn() && (
          !exists(/databases/$(database)/documents/chats/$(chatId)) ||
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participantes ||
          isPrivilegedEmail()
        );
        allow create: if isSignedIn() && (
          !exists(/databases/$(database)/documents/chats/$(chatId)) ||
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participantes
        );
        allow update: if isSignedIn() && (
          !exists(/databases/$(database)/documents/chats/$(chatId)) ||
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participantes
        );
        allow delete: if isPrivilegedEmail();
      }
      
      match /typing/{userId} {
        allow read: if isSignedIn();
        allow create, update: if isSignedIn() && request.auth.uid == userId;
        allow delete: if (isSignedIn() && request.auth.uid == userId) || isPrivilegedEmail();
      }
    }
    
    match /verificationRequests/{requestId} {
      allow get: if isSignedIn() && (resource == null || resource.data.userId == request.auth.uid || isAdmin() || isCEO() || isPrivilegedEmail());
      allow list: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin() || isCEO() || isPrivilegedEmail());
      allow create: if isSignedIn() && incoming().userId == request.auth.uid;
      allow update: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
      allow delete: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
    }
    
    match /reports/{reportId} {
      allow read, list: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
      allow create: if isSignedIn() && incoming().deUserId == request.auth.uid;
      allow update: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
      allow delete: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
    }
    
    match /blocks/{blockId} {
      allow get: if isSignedIn() && (resource == null || existing().blockedBy == request.auth.uid || existing().blockedUser == request.auth.uid);
      allow list: if isSignedIn() && (resource.data.blockedBy == request.auth.uid || resource.data.blockedUser == request.auth.uid);
      allow create: if isSignedIn() && incoming().blockedBy == request.auth.uid;
      allow update: if false;
      allow delete: if (isSignedIn() && existing().blockedBy == request.auth.uid) || isPrivilegedEmail();
    }
    
    match /profileViews/{viewId} {
      allow get: if isSignedIn() && (resource == null || resource.data.visitedId == request.auth.uid || resource.data.visitorId == request.auth.uid || isAdmin() || isCEO());
      allow list: if isSignedIn() && (resource.data.visitedId == request.auth.uid || resource.data.visitorId == request.auth.uid || isAdmin() || isCEO());
      allow create: if isSignedIn() && incoming().visitorId == request.auth.uid;
      allow update: if isSignedIn() && existing().visitorId == request.auth.uid && incoming().visitorId == request.auth.uid && incoming().visitedId == existing().visitedId;
      allow delete: if isPrivilegedEmail();
    }
    
    match /settings/{settingId} {
      allow read: if true;
      allow write: if isSignedIn() && (isAdmin() || isCEO() || isPrivilegedEmail());
    }
  }
}
`;

fs.writeFileSync('firestore.rules', originalRules);
