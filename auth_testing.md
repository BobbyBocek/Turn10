# Auth Testing Playbook (JWT e-post/lösenord + Emergent Google Auth)

Detta är en app med TVÅ auth-metoder mot samma `users`-collection:
- JWT e-post/lösenord → cookie `access_token` (även Bearer stöds)
- Emergent Google Auth → cookie `session_token` i `user_sessions`

## Testkonton
- Admin: tom.jenssen@live.se / Kortspel2026!
- Testspelare (lösen Spela123!): erik@test.se, johan@test.se, anders@test.se, sara@test.se, lisa@test.se

## API-test (JWT)
```
API=https://rating-cards-2.preview.emergentagent.com
curl -c c.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"tom.jenssen@live.se","password":"Kortspel2026!"}'
curl -b c.txt $API/api/auth/me
curl -b c.txt $API/api/users
curl -b c.txt $API/api/leaderboard
```

## Skapa match
```
curl -b c.txt -X POST $API/api/matches -H "Content-Type: application/json" \
  -d '{"participants":[{"user_id":"<id1>","placement":1},{"user_id":"<id2>","placement":2},{"user_id":"<id3>","placement":3}],"rule_ids":[]}'
```

## Google Auth-test (simulerad session)
Skapa user_session direkt i mongo och sätt cookie `session_token` för browsertest.
```
mongosh --eval "use('test_database'); db.user_sessions.insertOne({user_id:'<uuid>', session_token:'test_sess_123', expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(), created_at:new Date().toISOString()})"
curl $API/api/auth/me -H "Authorization: Bearer test_sess_123"
```

Success: /auth/me returnerar user, /matches skapar match med elo_delta, /leaderboard visar bara spelare med matches_played>=1.
