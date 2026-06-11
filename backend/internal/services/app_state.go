package services

import (
	"errors"
	"sync"
	"time"
)

type AppState struct {
	processingLock sync.Map
	scanLock       sync.Map
}

func NewAppState() *AppState {
	return &AppState{}
}

func (s *AppState) TryLockApplication(appID uint, userID uint) (func(), error) {
	key := appID
	_, loaded := s.processingLock.LoadOrStore(key, userID)
	if loaded {
		return nil, errors.New("该投保申请正在被其他用户处理，请稍后再试")
	}

	unlock := func() {
		s.processingLock.Delete(key)
	}

	go func() {
		time.Sleep(5 * time.Minute)
		s.processingLock.Delete(key)
	}()

	return unlock, nil
}

func (s *AppState) TryLockScan(appID uint, userID uint) (func(), error) {
	key := "scan_" + string(rune(appID))
	_, loaded := s.scanLock.LoadOrStore(key, userID)
	if loaded {
		return nil, errors.New("该投保申请正在扫码核验中，请稍后再试")
	}

	unlock := func() {
		s.scanLock.Delete(key)
	}

	go func() {
		time.Sleep(1 * time.Minute)
		s.scanLock.Delete(key)
	}()

	return unlock, nil
}

func (s *AppState) IsApplicationLocked(appID uint) bool {
	_, loaded := s.processingLock.Load(appID)
	return loaded
}
